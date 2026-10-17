"""Deterministic fixed-step authority. No networking or rendering dependencies."""
import math
import secrets
import time
from collections import Counter, deque
from dataclasses import dataclass, field

DT = 1 / 20
SPEED = 4.2
COLORS = ['#f6bd4f', '#6ad9c5', '#f47785', '#a99af4', '#75b8ed', '#f59e6d', '#c5db79', '#e69ed0', '#ded9cc', '#73a49c', '#cb8b75', '#8e9bd1']
FLOORS = [(-4, 4, -4, 4), (-14, -6, -4, 4), (6, 14, -4, 4), (-4, 4, -14, -6), (-4, 4, 6, 14), (-10, 10, -1.6, 1.6), (-1.6, 1.6, -10, 10)]
OBSTACLES = [(-12.5, -10.5, 1.5, 3), (10.5, 12.5, 1.5, 3), (-3, -1.5, -12.5, -10.5), (1.5, 3, 10.5, 12.5), (-.8, .8, -10.8, -9.2), (-.9, .9, -.9, .9)]
STATIONS = [{'id': 'garden', 'name': 'Balance the biofilter', 'room': 'Botanical', 'x': -12, 'z': -2, 'kind': 'sequence'}, {'id': 'relay', 'name': 'Align the relay', 'room': 'Comms', 'x': 12, 'z': -2, 'kind': 'dial'}, {'id': 'reactor', 'name': 'Restore the core', 'room': 'Reactor', 'x': 2, 'z': -12, 'kind': 'sequence'}, {'id': 'cargo', 'name': 'Sort the samples', 'room': 'Cargo', 'x': -2, 'z': 12, 'kind': 'sequence'}]
VENTS = [(-11, 0), (0, -11), (11, 0)]
LOBBY_OBSTACLES = [(-4.5, -2.7, -1.6, .2), (2.7, 4.5, -1.6, .2), (-1, 1, -4.4, -3.2)]

def distance(a, b):
    return math.hypot(a.x - b.x, a.z - b.z)

def walkable(x, z):
    return any(a + .3 <= x <= b - .3 and c + .3 <= z <= d - .3 for a, b, c, d in FLOORS) and not any(a - .3 < x < b + .3 and c - .3 < z < d + .3 for a, b, c, d in OBSTACLES)

def move(x, z, dx, dz, ghost=False, lobby=False):
    norm = max(1, math.hypot(dx, dz))
    nx, nz = x + dx / norm * SPEED * DT, z + dz / norm * SPEED * DT
    if ghost:
        return max(-14, min(14, nx)), max(-14, min(14, nz))
    def allowed(a, b):
        if lobby:
            return -5.7 <= a <= 5.7 and -4.7 <= b <= 4.7 and not any(l-.3 < a < r+.3 and t-.3 < b < d+.3 for l,r,t,d in LOBBY_OBSTACLES)
        return walkable(a, b)
    if allowed(nx, z): x = nx
    if allowed(x, nz): z = nz
    return x, z

@dataclass
class Player:
    id: str
    name: str
    color: str
    hat: str = 'sprout'
    x: float = 0
    z: float = 2
    role: str = 'crew'
    alive: bool = True
    connected: bool = True
    ready: bool = False
    tasks: list = field(default_factory=list)
    done: set = field(default_factory=set)
    inputs: deque = field(default_factory=lambda: deque(maxlen=20))
    ack: int = 0
    last_seq: int = 0
    kill_at: float = 0
    emergency: int = 1
    vent: int = -1
    challenge: dict | None = None
    last_chat: float = -100
    muted: bool = True
    deafened: bool = False
    disconnected_at: float = 0
    animation_until: float = 0

class GameError(ValueError): pass

class Room:
    def __init__(self, code, public=False, capacity=8, impostors=1, kill_cooldown=25, discussion=25):
        self.code, self.public, self.capacity = code, public, capacity
        self.impostors, self.kill_cooldown, self.discussion = impostors, kill_cooldown, discussion
        self.players = {}
        self.host = ''
        self.phase = 'lobby'
        self.now = time.monotonic()
        self.deadline = 0
        self.round = 0
        self.bodies = []
        self.votes = {}
        self.result = ''
        self.winner = ''
        self.sabotage_until = 0
        self.sabotage_at = 0
        self.meeting_at = 0
        self.chat = deque(maxlen=100)
        self.eliminations = []

    def add(self, name, color=0, hat='sprout'):
        if self.phase != 'lobby': raise GameError('This expedition has already launched.')
        if len(self.players) >= self.capacity: raise GameError('This room is full.')
        p = Player(secrets.token_hex(8), name, COLORS[color % len(COLORS)], hat)
        p.x = (len(self.players) % 4 - 1.5) * 1.1
        p.z = 2 + len(self.players) // 4 * .6
        self.players[p.id] = p
        if not self.host: self.host = p.id
        return p

    def require(self, condition, message):
        if not condition: raise GameError(message)

    def start(self, pid):
        self.require(pid == self.host and self.phase == 'lobby', 'Only the host can launch from the lobby.')
        active = list(self.players.values())
        self.require(len(active) >= 4 and all(p.connected and p.ready for p in active), 'At least four connected, ready players are needed.')
        count = min(self.impostors, (len(active) - 1) // 3)
        traitors = set(secrets.SystemRandom().sample([p.id for p in active], count))
        self.round += 1
        self.winner = self.result = ''
        self.bodies.clear(); self.votes.clear()
        self.eliminations.clear()
        self.sabotage_until = 0; self.sabotage_at = self.now + 20
        for i, p in enumerate(active):
            p.role = 'impostor' if p.id in traitors else 'crew'
            p.alive = True; p.done.clear(); p.vent = -1; p.emergency = 1; p.challenge = None; p.animation_until = 0
            p.tasks = [s['id'] for s in STATIONS] if p.role == 'crew' else []
            p.kill_at = self.now + self.kill_cooldown
            p.inputs.clear(); p.x = math.cos(i * math.tau / len(active)) * 2; p.z = math.sin(i * math.tau / len(active)) * 2
        self.phase = 'reveal'; self.deadline = self.now + 5

    def enqueue(self, p, seq, dx, dz, round_id):
        # Inputs already in flight at launch still refer to the lobby round.
        # Discard them without turning a normal snapshot race into a UI error.
        if round_id != self.round: return
        if self.phase not in ('lobby', 'playing') or not p.connected or p.vent >= 0 or self.now < p.animation_until: return
        if seq <= p.last_seq: return
        p.last_seq = seq
        if len(p.inputs) < 20: p.inputs.append((seq, dx, dz))

    def tick(self, now=None):
        self.now = time.monotonic() if now is None else now
        self.eliminations = [e for e in self.eliminations if self.now - e['started'] < 2.4]
        for p in self.players.values():
            if self.phase in ('lobby', 'playing') and p.connected and p.vent < 0 and self.now >= p.animation_until and p.inputs:
                p.ack, dx, dz = p.inputs.popleft()
                p.x, p.z = move(p.x, p.z, dx, dz, not p.alive, self.phase == 'lobby')
            else: p.inputs.clear()
            if p.challenge and math.hypot(p.x-p.challenge['x'],p.z-p.challenge['z']) > 2: p.challenge = None
            if not p.connected and self.now - p.disconnected_at > 45 and self.phase not in ('lobby','gameover'):
                p.alive = False
                if p.role == 'crew': p.done.update(p.tasks)
        if self.phase == 'reveal' and self.now >= self.deadline: self.phase = 'playing'; self.meeting_at = self.now + 15
        elif self.phase == 'discussion' and self.now >= self.deadline: self.phase = 'voting'; self.deadline = self.now + 30
        elif self.phase == 'voting' and (self.now >= self.deadline or len(self.votes) >= sum(p.alive and p.connected for p in self.players.values())): self.finish_vote()
        elif self.phase == 'results' and self.now >= self.deadline:
            self.phase = 'playing'; self.meeting_at = self.now + 20
            for p in self.players.values(): p.kill_at = self.now + self.kill_cooldown
        if self.phase in ('playing','discussion','voting','results'): self.check_win()

    def check_win(self):
        crew = [p for p in self.players.values() if p.role == 'crew']
        living_crew = sum(p.alive for p in crew)
        imps = sum(p.alive and p.role == 'impostor' for p in self.players.values())
        winner = ''
        if not imps: winner = 'crew'
        elif imps >= living_crew: winner = 'impostor'
        elif crew and all(len(p.done) == len(p.tasks) for p in crew): winner = 'crew'
        elif self.sabotage_until and self.now >= self.sabotage_until: winner = 'impostor'
        if winner: self.winner = winner; self.phase = 'gameover'; self.sabotage_until = 0

    def meeting(self, p, body=None):
        self.require(self.phase == 'playing' and p.alive and p.vent < 0, 'You cannot call a meeting now.')
        if body is not None:
            b = next((b for b in self.bodies if b['id'] == body), None)
            self.require(b is not None and math.hypot(p.x-b['x'],p.z-b['z']) <= 2.5, 'No body in reporting range.')
            self.result = f'{p.name} reported a fallen crewmate.'
        else:
            self.require(p.emergency > 0 and self.now >= self.meeting_at and not self.sabotage_until and math.hypot(p.x, p.z) <= 2.5, 'Approach the meeting beacon. Meetings are unavailable during an emergency or cooldown.')
            p.emergency -= 1; self.result = f'{p.name} called an emergency meeting.'
        self.phase = 'discussion'; self.deadline = self.now + self.discussion
        self.votes.clear(); self.bodies.clear(); self.sabotage_until = 0
        for q in self.players.values(): q.vent = -1; q.challenge = None; q.inputs.clear()

    def finish_vote(self):
        counts = Counter(self.votes.values())
        ranking = counts.most_common()
        target = ranking[0][0] if ranking and (len(ranking) == 1 or ranking[0][1] > ranking[1][1]) else 'skip'
        if target != 'skip' and target in self.players:
            self.players[target].alive = False; self.result = f'{self.players[target].name} was sent into the clouds.'
        else: self.result = 'No one was ejected. Trust remains uncertain.'
        self.phase = 'results'; self.deadline = self.now + 6
        self.check_win()

    def action(self, pid, action, target='', value=None):
        p = self.players[pid]
        if action == 'rename':
            self.require(self.phase == 'lobby', 'Change your name in the waiting room.')
            name = ''.join(c for c in target.strip() if c.isprintable())
            self.require(1 <= len(name) <= 18, 'Choose a name with 1–18 characters.')
            p.name = name
            return
        if action == 'ready':
            self.require(self.phase == 'lobby', 'Already launched.'); p.ready = not p.ready; return
        if action == 'start': self.start(pid); return
        if action == 'rematch':
            self.require(pid == self.host and self.phase == 'gameover', 'Only the host can return everyone to the lobby.')
            self.phase = 'lobby'; self.bodies.clear(); self.votes.clear(); self.eliminations.clear()
            for i, q in enumerate(self.players.values()):
                q.ready = False; q.alive = True; q.role = 'crew'; q.vent = -1; q.x = (i % 4 - 1.5) * 1.1; q.z = 2 + i // 4 * .6; q.challenge = None; q.animation_until = 0; q.inputs.clear()
            return
        if action == 'vote':
            self.require(self.phase == 'voting' and p.alive and pid not in self.votes, 'You cannot vote now.')
            self.require(target == 'skip' or target in self.players and self.players[target].alive, 'Invalid vote.')
            self.votes[pid] = target; return
        self.require(self.phase == 'playing', 'Wait for exploration to begin.')
        self.require(self.now >= p.animation_until, 'Elimination animation is finishing.')
        if action == 'kill':
            q = self.players.get(target)
            self.require(p.alive and p.role == 'impostor' and p.vent < 0 and self.now >= p.kill_at and q is not None and q.alive and q.role == 'crew' and q.vent < 0 and distance(p,q) <= 1.8, 'No eligible target in range, or eliminator cooling down.')
            self.require(self.now >= q.animation_until, 'That explorer is busy.')
            style = secrets.randbelow(4) if value is None or value == -1 else value
            self.require(type(style) is int and 0 <= style <= 3, 'Unknown elimination style.')
            self.eliminations.append({
                'id': secrets.token_hex(8), 'started': self.now, 'style': style,
                'attacker': {k: getattr(p, k) for k in ('id', 'name', 'color', 'hat', 'x', 'z')},
                'victim': {k: getattr(q, k) for k in ('id', 'name', 'color', 'hat', 'x', 'z')},
                'recipients': [v.id for v in self.players.values() if v.id in (p.id, q.id) or distance(v, q) <= 6],
            })
            p.animation_until = q.animation_until = self.now + 2.4
            p.inputs.clear(); q.inputs.clear()
            q.alive = False; q.challenge = None
            self.bodies.append({'id':q.id,'x':q.x,'z':q.z,'color':q.color})
            p.kill_at = self.now + self.kill_cooldown; self.check_win()
        elif action == 'report': self.meeting(p, target)
        elif action == 'meeting': self.meeting(p)
        elif action == 'sabotage':
            self.require(p.alive and p.role == 'impostor' and self.now >= self.sabotage_at and not self.sabotage_until, 'Sabotage is unavailable.')
            self.sabotage_until = self.now + 55; self.sabotage_at = self.now + 80
        elif action == 'repair':
            self.require(p.alive and p.vent < 0 and self.sabotage_until and math.hypot(p.x-2,p.z+12) <= 2, 'Approach the reactor console to repair it.')
            self.sabotage_until = 0
        elif action == 'vent':
            self.require(p.role == 'impostor' and p.alive, 'Only impostors can use service ducts.')
            if p.vent >= 0:
                if target == 'next': p.vent = (p.vent+1)%len(VENTS); p.x,p.z = VENTS[p.vent]
                else: p.vent = -1
            else:
                idx = min(range(len(VENTS)), key=lambda i: math.hypot(p.x-VENTS[i][0],p.z-VENTS[i][1]))
                self.require(math.hypot(p.x-VENTS[idx][0],p.z-VENTS[idx][1]) <= 1.7,'Approach a service duct.'); p.vent = idx; p.x,p.z = VENTS[idx]
        elif action == 'task_cancel': p.challenge = None
        elif action == 'task_begin':
            s = next((s for s in STATIONS if s['id'] == target), None)
            self.require(p.role == 'crew' and target in p.tasks and target not in p.done and s and math.hypot(p.x-s['x'],p.z-s['z']) <= 2, 'Approach an unfinished task station.')
            sequence = [secrets.randbelow(4) for _ in range(4)]
            p.challenge = {**s,'nonce':secrets.token_hex(12),'sequence':sequence,'step':0,'started':self.now}
        elif action == 'task_step':
            c = p.challenge
            self.require(c and target == c['nonce'] and math.hypot(p.x-c['x'],p.z-c['z']) <= 2, 'This task has expired.')
            self.require(type(value) is int and value == c['sequence'][c['step']], 'Wrong circuit. Follow the illuminated sequence.')
            self.require(self.now - c['started'] >= (c['step']+1)*.3, 'Slow down and let the circuit settle.')
            c['step'] += 1
            if c['step'] == 4: p.done.add(c['id']); p.challenge = None; self.check_win()
        else: raise GameError('Unknown action.')

    def voice_gain(self, source, recipient):
        a,b = self.players.get(source), self.players.get(recipient)
        if not a or not b or a is b or not a.connected or not b.connected or a.muted or b.deafened: return 0.
        if self.phase in ('lobby','gameover'): return 1.
        if a.alive != b.alive: return 0.
        if not a.alive or self.phase in ('discussion','voting','results'): return 1.
        if self.phase == 'reveal' or a.vent >= 0 or b.vent >= 0: return 0.
        d = distance(a,b)
        return max(0., min(1., (9-d)/6)) ** 2

    def can_chat(self, source, recipient):
        a,b = self.players[source],self.players[recipient]
        if self.phase in ('lobby','gameover'): return True
        if a.alive != b.alive: return False
        return not a.alive or self.phase in ('discussion','voting','results')

    def add_chat(self, pid, text):
        p = self.players[pid]
        self.require(self.can_chat(pid,pid), 'Living players can text during meetings. Use proximity voice while exploring.')
        self.require(self.now-p.last_chat >= 1, 'Please wait a moment between messages.')
        p.last_chat = self.now
        msg = {'id':secrets.token_hex(6),'name':p.name,'player':pid,'text':text,'time':int(time.time()*1000),'channel':'ghost' if not p.alive and self.phase != 'gameover' else self.phase,'recipients':[i for i in self.players if self.can_chat(pid,i)]}
        self.chat.append(msg)
        return msg

    def snapshot(self, pid):
        me = self.players[pid]
        players = []
        for p in self.players.values():
            if p.id != pid and self.phase not in ('lobby','gameover','discussion','voting','results'):
                if (not p.alive and me.alive) or p.vent >= 0: continue
            row = {k:getattr(p,k) for k in ('id','name','color','hat','x','z','alive','connected','ready','ack')}
            if p.id == pid or self.phase == 'gameover' or me.role == 'impostor' and p.role == 'impostor': row['role'] = p.role
            row['voted'] = p.id in self.votes
            players.append(row)
        crew = [p for p in self.players.values() if p.role == 'crew']
        eliminations = [{k: v for k, v in e.items() if k not in ('recipients', 'started')} | {'elapsed': self.now-e['started']} for e in self.eliminations if pid in e['recipients'] and self.now-e['started'] < 2.4]
        return {'code':self.code,'host':self.host,'public':self.public,'capacity':self.capacity,'impostors':self.impostors,'phase':self.phase,'round':self.round,'players':players,'bodies':self.bodies,'remaining':max(0,self.deadline-self.now),'result':self.result,'winner':self.winner,'sabotage':max(0,self.sabotage_until-self.now),'killCooldown':max(0,me.kill_at-self.now),'sabotageCooldown':max(0,self.sabotage_at-self.now),'meetingCooldown':max(0,self.meeting_at-self.now),'emergency':me.emergency,'vent':me.vent,'tasks':[{**s,'done':s['id'] in me.done} for s in STATIONS if s['id'] in me.tasks],'challenge':me.challenge,'progress':sum(len(p.done) for p in crew)/max(1,sum(len(p.tasks) for p in crew)),'tally':dict(Counter(self.votes.values())) if self.phase in ('results','gameover') else {},'population':len(self.players),'eliminations':eliminations,'movementLock':max(0,me.animation_until-self.now)}
