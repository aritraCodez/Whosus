from __future__ import annotations

import math
import secrets
import time
from collections import Counter, deque

from app.features.appearance.catalog import COSMETICS

from .actions import handle_match_action
from .bots import Bot, tick_bots
from .communication import add_chat, can_chat, voice_gain
from .entities import Player
from .exceptions import GameError
from .lobby import handle_lobby_action
from .snapshot import build_snapshot
from .types import ActionValue, Body, ChatRecord, EliminationRecord, Snapshot, VisualTask
from .world import ARRIVAL_SEAT_TIME, COLORS, LOBBY_SEATS, STATIONS, move


class Room:
    def __init__(
        self,
        code: str,
        public: bool = False,
        capacity: int = 8,
        killers: int = 1,
        kill_cooldown: int = 25,
        discussion: int = 25,
        movement_speed: float = 1,
        voting: int = 30,
        emergency_meetings: int = 1,
        meeting_cooldown: int = 20,
    ) -> None:
        self.code, self.public, self.capacity = code, public, capacity
        self.killers, self.kill_cooldown, self.discussion = killers, kill_cooldown, discussion
        self.movement_speed, self.voting = movement_speed, voting
        self.emergency_meetings, self.meeting_cooldown = emergency_meetings, meeting_cooldown
        self.players: dict[str, Player] = {}
        self.bots: dict[str, Bot] = {}
        self.host = ""
        self.phase = "lobby"
        self.now = time.monotonic()
        self.deadline: float = 0
        self.round = 0
        self.bodies: list[Body] = []
        self.votes: dict[str, str] = {}
        self.result = ""
        self.winner = ""
        self.sabotage_until: float = 0
        self.sabotage_at: float = 0
        self.meeting_at: float = 0
        self.chat: deque[ChatRecord] = deque(maxlen=100)
        self.eliminations: list[EliminationRecord] = []
        self.visual_tasks = True
        self.task_bar_mode = "always"
        self.meeting_progress = 0.0
        self.active_visuals: list[VisualTask] = []

    def add(
        self,
        name: str,
        color: int = 0,
        hat: str = "sprout",
        outfit: str = "none",
        visor: str = "none",
        accessory: str = "none",
        boots: str = "original",
    ) -> Player:
        if self.phase != "lobby":
            raise GameError("This expedition has already launched.")
        if len(self.players) >= self.capacity:
            raise GameError("This room is full.")
        used = {p.color for p in self.players.values()}
        palette = COLORS[color % len(COLORS) :] + COLORS[: color % len(COLORS)]
        chosen = next((c for c in palette if c not in used), None)
        if chosen is None:
            raise GameError("No explorer colors available.")
        look = dict(hat=hat, outfit=outfit, visor=visor, accessory=accessory, boots=boots)
        self.require(
            all(value in COSMETICS[slot] for slot, value in look.items()), "Unknown wardrobe item."
        )
        p = Player(
            secrets.token_hex(8),
            name,
            chosen,
            hat=hat,
            outfit=outfit,
            visor=visor,
            accessory=accessory,
            boots=boots,
        )
        occupied = {q.seat for q in self.players.values() if q.seat >= 0}
        preferred = len(self.players) % len(LOBBY_SEATS)
        p.seat = next(
            (preferred + i) % len(LOBBY_SEATS)
            for i in range(len(LOBBY_SEATS))
            if (preferred + i) % len(LOBBY_SEATS) not in occupied
        )
        p.x, p.z = LOBBY_SEATS[p.seat]
        p.seated_until = self.now + ARRIVAL_SEAT_TIME
        self.players[p.id] = p
        if not self.host:
            self.host = p.id
        return p

    def require(self, condition: object, message: str) -> None:
        if not condition:
            raise GameError(message)

    def stand(self, p: Player) -> None:
        if p.seat < 0:
            return
        x, z = LOBBY_SEATS[p.seat]
        p.x, p.z = math.copysign(4.85, x), z
        p.seat = -1
        p.seated_until = 0
        p.inputs.clear()

    def start(self, pid: str) -> None:
        self.require(
            pid == self.host and self.phase == "lobby", "Only the host can launch from the lobby."
        )
        active = list(self.players.values())
        self.require(
            len(active) >= 4 and all(p.connected and p.ready for p in active),
            "At least four connected, ready players are needed.",
        )
        count = min(self.killers, (len(active) - 1) // 3)
        traitors = set(secrets.SystemRandom().sample([p.id for p in active], count))
        self.round += 1
        self.winner = self.result = ""
        self.bodies.clear()
        self.votes.clear()
        self.eliminations.clear()
        self.active_visuals.clear()
        self.sabotage_until = 0
        self.sabotage_at = self.now + 20
        for i, p in enumerate(active):
            p.role = "killer" if p.id in traitors else "crew"
            p.alive = True
            p.done.clear()
            p.vent = -1
            p.emergency = self.emergency_meetings
            p.challenge = None
            p.animation_until = 0
            p.seat = -1
            p.seated_until = 0
            p.tasks = [s["id"] for s in STATIONS]
            p.kill_at = self.now + self.kill_cooldown
            p.inputs.clear()
            p.x = math.cos(i * math.tau / len(active)) * 2
            p.z = math.sin(i * math.tau / len(active)) * 2
        self.phase = "reveal"
        self.deadline = self.now + 5

    def enqueue(self, p: Player, seq: int, dx: float, dz: float, round_id: int) -> None:
        # Inputs already in flight at launch still refer to the lobby round.
        # Discard them without turning a normal snapshot race into a UI error.
        if round_id != self.round:
            return
        if (
            self.phase not in ("lobby", "playing")
            or not p.connected
            or p.vent >= 0
            or self.now < p.animation_until
        ):
            return
        if seq <= p.last_seq:
            return
        if self.phase == "lobby" and p.seat >= 0:
            if dx or dz:
                self.stand(p)
            else:
                p.last_seq = p.ack = seq
                return
        p.last_seq = seq
        if len(p.inputs) < 50:
            p.inputs.append((seq, dx, dz))

    def tick(self, now: float | None = None) -> None:
        self.now = time.monotonic() if now is None else now
        tick_bots(self)
        self.eliminations = [e for e in self.eliminations if self.now - e["started"] < 2.4]
        for p in self.players.values():
            if (
                self.phase == "lobby"
                and p.seat >= 0
                and (not p.connected or p.seated_until and self.now >= p.seated_until)
            ):
                self.stand(p)
            if (
                self.phase in ("lobby", "playing")
                and p.connected
                and p.vent < 0
                and self.now >= p.animation_until
                and p.inputs
            ):
                p.ack, dx, dz = p.inputs.popleft()
                p.x, p.z = move(
                    p.x, p.z, dx, dz, not p.alive, self.phase == "lobby", self.movement_speed
                )
            else:
                p.inputs.clear()
            if p.challenge and math.hypot(p.x - p.challenge["x"], p.z - p.challenge["z"]) > 2.5:
                p.challenge = None
            if (
                not p.connected
                and self.now - p.disconnected_at > 45
                and self.phase not in ("lobby", "gameover")
            ):
                p.alive = False
                if p.role == "crew":
                    p.done.update(p.tasks)
        if self.phase == "reveal" and self.now >= self.deadline:
            self.phase = "playing"
            self.meeting_at = self.now + self.meeting_cooldown
        elif self.phase == "discussion" and self.now >= self.deadline:
            self.phase = "voting"
            self.deadline = self.now + self.voting
        elif self.phase == "voting" and (
            self.now >= self.deadline
            or len(self.votes) >= sum(p.alive and p.connected for p in self.players.values())
        ):
            self.finish_vote()
        elif self.phase == "results" and self.now >= self.deadline:
            self.phase = "playing"
            self.meeting_at = self.now + self.meeting_cooldown
            for p in self.players.values():
                p.kill_at = self.now + self.kill_cooldown
        if self.phase in ("playing", "discussion", "voting", "results"):
            self.check_win()

    def check_win(self) -> None:
        crew = [p for p in self.players.values() if p.role == "crew"]
        living_crew = sum(p.alive for p in crew)
        imps = sum(p.alive and p.role == "killer" for p in self.players.values())
        winner = ""
        if not imps:
            winner = "crew"
        elif imps >= living_crew:
            winner = "killer"
        elif crew and all(len(p.done) == len(p.tasks) for p in crew):
            winner = "crew"
        elif self.sabotage_until and self.now >= self.sabotage_until:
            winner = "killer"
        if winner:
            self.winner = winner
            self.phase = "gameover"
            self.sabotage_until = 0

    def meeting(self, p: Player, body: str | None = None) -> None:
        self.require(
            self.phase == "playing" and p.alive and p.vent < 0, "You cannot call a meeting now."
        )
        if body is not None:
            b = next((b for b in self.bodies if b["id"] == body), None)
            if b is None or math.hypot(p.x - b["x"], p.z - b["z"]) > 2.5:
                raise GameError("No body in reporting range.")
            self.result = f"{p.name} reported a fallen crewmate."
        else:
            self.require(
                p.emergency > 0
                and self.now >= self.meeting_at
                and not self.sabotage_until
                and math.hypot(p.x, p.z) <= 2.5,
                "Approach the meeting beacon. Meetings are unavailable during an emergency or cooldown.",
            )
            p.emergency -= 1
            self.result = f"{p.name} called an emergency meeting."
        self.phase = "discussion"
        self.deadline = self.now + self.discussion
        self.votes.clear()
        self.bodies.clear()
        self.sabotage_until = 0
        for q in self.players.values():
            q.vent = -1
            q.challenge = None
            q.inputs.clear()

    def finish_vote(self) -> None:
        counts = Counter(self.votes.values())
        ranking = counts.most_common()
        target = (
            ranking[0][0]
            if ranking and (len(ranking) == 1 or ranking[0][1] > ranking[1][1])
            else "skip"
        )
        if target != "skip" and target in self.players:
            self.players[target].alive = False
            self.result = f"{self.players[target].name} was sent into the clouds."
        else:
            self.result = "No one was ejected. Trust remains uncertain."
        self.phase = "results"
        self.deadline = self.now + 6
        self.check_win()

    def action(self, pid: str, action: str, target: str = "", value: ActionValue = None) -> None:
        p = self.players[pid]
        if not handle_lobby_action(self, p, action, target, value):
            handle_match_action(self, p, action, target, value)

    def voice_gain(self, source: str, recipient: str) -> float:
        return voice_gain(self, source, recipient)

    def can_chat(self, source: str, recipient: str) -> bool:
        return can_chat(self, source, recipient)

    def add_chat(self, pid: str, text: str) -> ChatRecord:
        return add_chat(self, pid, text)

    def snapshot(self, pid: str) -> Snapshot:
        return build_snapshot(self, pid)
