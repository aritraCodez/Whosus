from pydantic import BaseModel


class PublicRoom(BaseModel):
    code: str
    players: int
    capacity: int
    host: str
