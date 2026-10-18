from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class IceCandidate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    candidate: str = Field(max_length=2048)
    sdpMid: str | None = Field(default=None, max_length=32)
    sdpMLineIndex: int | None = Field(default=None, ge=0, le=7)
    usernameFragment: str | None = Field(default=None, max_length=128)


class Message(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    type: Literal[
        'create', 'join', 'resume', 'input', 'action', 'chat', 'voice_offer',
        'voice_ice', 'voice_stop', 'voice_state', 'leave', 'ping',
    ]
    name: str = Field(default='Explorer', min_length=1, max_length=18)
    code: str = Field(default='', max_length=6)
    token: str = Field(default='', max_length=128)
    color: int = Field(default=0, ge=0, le=11)
    hat: Literal['sprout', 'antenna', 'none'] = 'sprout'
    public: bool = False
    capacity: int = Field(default=8, ge=4, le=12)
    impostors: int = Field(default=1, ge=1, le=3)
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
    action: str = Field(default='', max_length=20)
    target: str = Field(default='', max_length=64)
    value: bool | int | float | str | None = Field(default=None, union_mode='smart')
    text: str = Field(default='', max_length=280)
    sdp: str = Field(default='', max_length=16000)
    generation: int = Field(default=0, ge=0, le=2**31)
    candidate: IceCandidate | None = None
    muted: bool = True
    deafened: bool = False
