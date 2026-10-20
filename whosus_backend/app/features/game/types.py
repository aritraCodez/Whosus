"""Game records and the existing browser wire shapes; no persistence models."""

from typing import NotRequired, TypeAlias

from typing_extensions import TypedDict

ActionValue: TypeAlias = bool | int | float | str | None


class Station(TypedDict):
    id: str
    name: str
    room: str
    x: float
    z: float
    category: str
    kind: str
    visual: bool
    visual_kind: NotRequired[str]


class Challenge(Station):
    nonce: str
    sequence: list[int]
    step: int
    started: float
    error: NotRequired[str]


class TaskSnapshot(Station):
    done: bool


class CharacterSnapshot(TypedDict):
    id: str
    name: str
    color: str
    hat: str
    outfit: str
    visor: str
    accessory: str
    boots: str
    x: float
    z: float


class PlayerSnapshot(CharacterSnapshot):
    alive: bool
    connected: bool
    ready: bool
    ack: int
    seat: int
    voted: bool
    role: NotRequired[str]


class Body(TypedDict):
    id: str
    x: float
    z: float
    color: str


class Elimination(TypedDict):
    id: str
    style: int
    attacker: CharacterSnapshot
    victim: CharacterSnapshot


class EliminationRecord(Elimination):
    started: float
    recipients: list[str]


class EliminationSnapshot(Elimination):
    elapsed: float


class VisualTask(TypedDict):
    player: str
    task: str
    kind: str
    until: float


class ChatMessage(TypedDict):
    id: str
    name: str
    player: str
    text: str
    time: int
    channel: str


class ChatRecord(ChatMessage):
    recipients: list[str]


class RoomRules(TypedDict):
    killCooldown: int
    discussion: int
    voting: int
    emergencyMeetings: int
    meetingCooldown: int


class Snapshot(TypedDict):
    code: str
    host: str
    public: bool
    capacity: int
    movementSpeed: float
    rules: RoomRules
    killers: int
    phase: str
    round: int
    players: list[PlayerSnapshot]
    bodies: list[Body]
    remaining: float
    result: str
    winner: str
    sabotage: float
    killCooldown: float
    sabotageCooldown: float
    meetingCooldown: float
    emergency: int
    vent: int
    tasks: list[TaskSnapshot]
    challenge: Challenge | None
    progress: float
    taskBarMode: str
    visualTasks: bool
    visuals: list[VisualTask]
    tally: dict[str, int]
    population: int
    eliminations: list[EliminationSnapshot]
    movementLock: float
