"""Room-scoped WebRTC signaling policy. Audio travels between browsers."""
import time


def ice_config(stun_urls):
    return [{'urls': url} for url in stun_urls]


class VoiceRouter:
    def __init__(self, stun_urls=()):
        self.ice_servers = ice_config(stun_urls)
        self.enabled = set()
        self.talking = {}

    def can_signal(self, room, source, recipient):
        a, b = room.players.get(source), room.players.get(recipient)
        return bool(
            a and b and a is not b and a.connected and b.connected
            and source in self.enabled and recipient in self.enabled
            and (room.phase in ('lobby', 'gameover') or a.alive == b.alive)
        )

    def peers(self, room, pid):
        return [
            {'id': other, 'gain': room.voice_gain(other, pid), 'sendGain': room.voice_gain(pid, other)}
            for other in room.players if self.can_signal(room, pid, other)
        ]

    def state(self, pid, enabled, talking):
        if enabled:
            self.enabled.add(pid)
        else:
            self.enabled.discard(pid)
        if enabled and talking:
            self.talking[pid] = time.monotonic()
        else:
            self.talking.pop(pid, None)

    def speaking(self, room, pid):
        now = time.monotonic()
        return [
            source for source, at in self.talking.items()
            if now - at < .7 and source in room.players
            and (room.voice_gain(source, pid) > 0 or source == pid and not room.players[pid].muted)
        ]

    async def close(self, pid):
        self.enabled.discard(pid)
        self.talking.pop(pid, None)

    async def shutdown(self):
        self.enabled.clear()
        self.talking.clear()
