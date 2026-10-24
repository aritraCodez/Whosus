import secrets
import time

from app.core.limits import MAX_SESSIONS, SESSION_RETENTION
from app.core.security import clean_text
from app.features.game.exceptions import GameError
from app.features.game.service import Room
from app.runtime import Runtime, Session

from .connection import Connection
from .schemas import ChatEvent, JoinedEvent, Message, NoticeEvent, SimpleEvent, VoiceSignalEvent


class GameService:
    """Session authentication and game commands, independent of ASGI routing."""

    def __init__(self, runtime: Runtime) -> None:
        self.runtime = runtime

    async def establish(self, message: Message, conn: Connection) -> Session | None:
        if message.type == "resume":
            session = self.runtime.sessions.get(message.token)
            if not session or session.pid not in session.room.players:
                conn.send(
                    NoticeEvent(
                        type="expired", message="Your session expired. Join a new expedition."
                    )
                )
                return None
            async with session.takeover:
                if session.conn:
                    await session.conn.close(4001)
                if (
                    self.runtime.sessions.get(message.token) is not session
                    or session.pid not in session.room.players
                ):
                    conn.send(
                        NoticeEvent(
                            type="expired", message="Your session expired. Join a new expedition."
                        )
                    )
                    return None
                await self.runtime.voice.close(session.pid)
                self.bind(session, conn)
        else:
            if len(self.runtime.sessions) >= MAX_SESSIONS:
                raise GameError("Server is at capacity.")
            name = clean_text(message.name)
            if not name:
                raise GameError("Choose an explorer name.")
            if message.type == "create":
                code = self.room_code()
                room = Room(
                    code,
                    message.public,
                    message.capacity,
                    message.killers,
                    message.kill_cooldown,
                    message.discussion,
                    message.movement_speed,
                    message.voting,
                    message.emergency_meetings,
                    message.meeting_cooldown,
                    message.map_id,
                )
            else:
                existing = self.runtime.rooms.get(message.code.upper())
                if existing is None:
                    raise GameError("No room with that code. Check it and try again.")
                room = existing
            player = room.add(
                name,
                message.color,
                message.hat,
                message.outfit,
                message.visor,
                message.accessory,
                message.boots,
                message.character,
            )
            self.runtime.rooms[room.code] = room
            session = Session(room=room, pid=player.id, token=secrets.token_urlsafe(32))
            self.runtime.sessions[session.token] = session
            self.bind(session, conn)
        conn.send(
            JoinedEvent(
                id=session.pid, token=session.token, iceServers=self.runtime.voice.ice_servers
            )
        )
        return session

    @staticmethod
    def bind(session: Session, conn: Connection) -> None:
        session.conn = conn
        player = session.room.players[session.pid]
        player.connected = True
        player.muted = True
        player.inputs.clear()
        player.last_seq = player.ack

    def room_code(self) -> str:
        while True:
            code = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(6))
            if code not in self.runtime.rooms:
                return code

    async def dispatch(
        self, message: Message, conn: Connection, session: Session | None
    ) -> Session | None:
        if message.type == "ping":
            conn.send(SimpleEvent(type="pong"))
            return session
        if message.type in ("create", "join", "resume"):
            if session:
                raise GameError("Already in a room.")
            return await self.establish(message, conn)
        if not session or session.conn is not conn or session.pid not in session.room.players:
            raise GameError("Join a room first.")
        room, pid = session.room, session.pid
        player = room.players[pid]
        if message.type == "input":
            room.enqueue(player, message.seq, message.dx, message.dz, message.round)
        elif message.type == "action":
            room.action(pid, message.action, message.target, message.value)
            if message.action == "kick":
                await self.kick(room, message.target)
        elif message.type == "chat":
            text = clean_text(message.text)
            if text:
                record = room.add_chat(pid, text)
                event = ChatEvent(message=record)
                for other in self.runtime.sessions.values():
                    if other.room is room and other.pid in record["recipients"] and other.conn:
                        other.conn.send(event)
        elif message.type == "voice_state":
            player.muted = message.muted
            player.deafened = message.deafened
            self.runtime.voice.state(pid, message.enabled, message.talking and not message.muted)
        elif message.type == "voice_signal":
            self.signal(room, pid, message)
        elif message.type == "leave":
            player.connected = False
            player.disconnected_at = time.monotonic() - SESSION_RETENTION - 1
            player.muted = True
            if room.phase not in ("lobby", "gameover"):
                player.alive = False
                if player.role == "crew":
                    player.done.update(player.tasks)
                room.check_win()
            await self.runtime.voice.close(pid)
            session.conn = None
            self.runtime.sessions.pop(session.token, None)
            conn.send(SimpleEvent(type="left"))
            return None
        return session

    async def kick(self, room: Room, pid: str) -> None:
        for token, removed in list(self.runtime.sessions.items()):
            if removed.room is room and removed.pid == pid:
                if removed.conn:
                    removed.conn.send(
                        NoticeEvent(type="kicked", message="The host removed you from the room.")
                    )
                removed.conn = None
                self.runtime.sessions.pop(token, None)
        await self.runtime.voice.close(pid)

    def signal(self, room: Room, pid: str, message: Message) -> None:
        if not self.runtime.voice.can_signal(room, pid, message.to):
            return
        target = self.runtime.recipient(room, message.to)
        if target is None:
            return
        if message.kind in ("offer", "answer"):
            if (
                "m=video" in message.sdp
                or message.sdp.count("m=audio") != 1
                or "m=application" in message.sdp
            ):
                raise GameError("Only one audio channel is supported.")
            event = VoiceSignalEvent(
                from_=pid, kind=message.kind, generation=message.generation, sdp=message.sdp
            )
        elif message.kind == "ice":
            candidate = message.candidate
            if candidate and candidate.candidate:
                if not candidate.candidate.startswith("candidate:"):
                    raise GameError("Invalid ICE candidate.")
                if candidate.sdpMid is None and candidate.sdpMLineIndex is None:
                    raise GameError("ICE candidate is missing its audio channel.")
            event = VoiceSignalEvent(
                from_=pid, kind=message.kind, generation=message.generation, candidate=candidate
            )
        else:
            event = VoiceSignalEvent(from_=pid, kind=message.kind, generation=message.generation)
        target.send(event)

    async def disconnect(self, session: Session | None, conn: Connection) -> None:
        if session and session.conn is conn:
            session.conn = None
            player = session.room.players.get(session.pid)
            if player:
                player.connected = False
                player.disconnected_at = time.monotonic()
                player.muted = True
                player.inputs.clear()
            await self.runtime.voice.close(session.pid)
