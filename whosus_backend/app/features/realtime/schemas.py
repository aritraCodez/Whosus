from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.features.appearance.catalog import Accessory, Boots, Character, Hat, Outfit, Visor
from app.features.game.maps import MapId
from app.features.game.types import ChatMessage, Snapshot
from app.features.voice.types import IceServer, VoicePeer


class IceCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    candidate: str = Field(max_length=2048)
    sdpMid: str | None = Field(default=None, max_length=32)
    sdpMLineIndex: int | None = Field(default=None, ge=0, le=7)
    usernameFragment: str | None = Field(default=None, max_length=128)


class Message(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    type: Literal[
        "create",
        "join",
        "resume",
        "input",
        "action",
        "chat",
        "voice_signal",
        "voice_state",
        "leave",
        "ping",
    ]
    name: str = Field(default="Explorer", min_length=1, max_length=18)
    code: str = Field(default="", max_length=6)
    token: str = Field(default="", max_length=128, repr=False)
    color: int = Field(default=0, ge=0, le=11)
    hat: Hat = "sprout"
    outfit: Outfit = "none"
    visor: Visor = "none"
    accessory: Accessory = "none"
    boots: Boots = "original"
    character: Character = "pip"
    map_id: MapId = "cloudline"
    public: bool = False
    capacity: int = Field(default=8, ge=4, le=12)
    killers: int = Field(default=1, ge=1, le=3)
    kill_cooldown: int = Field(default=25, ge=10, le=60)
    discussion: int = Field(default=25, ge=10, le=90)
    movement_speed: float = Field(default=1, ge=0.5, le=2)
    voting: int = Field(default=30, ge=10, le=120)
    emergency_meetings: int = Field(default=1, ge=0, le=3)
    meeting_cooldown: int = Field(default=20, ge=10, le=60)
    seq: int = Field(default=0, ge=0, le=2**31)
    round: int = Field(default=0, ge=0)
    dx: float = Field(default=0, ge=-1, le=1)
    dz: float = Field(default=0, ge=-1, le=1)
    action: str = Field(default="", max_length=20)
    target: str = Field(default="", max_length=64)
    value: bool | int | float | str | None = Field(default=None, union_mode="smart")
    text: str = Field(default="", max_length=280)
    sdp: str = Field(default="", max_length=16000)
    generation: int = Field(default=0, ge=0, le=2**53 - 1)
    to: str = Field(default="", max_length=64)
    kind: Literal["offer", "answer", "ice", "reset"] = "ice"
    candidate: IceCandidate | None = None
    muted: bool = True
    deafened: bool = False
    enabled: bool = False
    talking: bool = False


class JoinedEvent(BaseModel):
    type: Literal["joined"] = "joined"
    id: str
    token: str = Field(repr=False)
    iceServers: list[IceServer]


class SnapshotEvent(BaseModel):
    type: Literal["snapshot"] = "snapshot"
    room: Snapshot
    speaking: list[str]
    voicePeers: list[VoicePeer]


class ChatEvent(BaseModel):
    type: Literal["chat"] = "chat"
    message: ChatMessage


class VoiceSignalEvent(BaseModel):
    type: Literal["voice_signal"] = "voice_signal"
    from_: str = Field(serialization_alias="from")
    kind: Literal["offer", "answer", "ice", "reset"]
    generation: int
    sdp: str | None = None
    candidate: IceCandidate | None = None


class NoticeEvent(BaseModel):
    type: Literal["error", "expired", "kicked"]
    message: str


class SimpleEvent(BaseModel):
    type: Literal["pong", "left"]


ServerEvent = JoinedEvent | SnapshotEvent | ChatEvent | VoiceSignalEvent | NoticeEvent | SimpleEvent
