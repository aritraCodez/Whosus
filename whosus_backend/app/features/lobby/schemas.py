from pydantic import BaseModel


class PublicRoom(BaseModel):
    mapId: str = "cloudline"
    code: str
    players: int
    capacity: int
    host: str
