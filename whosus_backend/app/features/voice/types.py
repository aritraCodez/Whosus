from typing_extensions import TypedDict


class IceServer(TypedDict):
    urls: str


class VoicePeer(TypedDict):
    id: str
    gain: float
    sendGain: float
