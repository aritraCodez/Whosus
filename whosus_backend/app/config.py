from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra='ignore')

    allowed_origins: Annotated[list[str], NoDecode]

    @field_validator('allowed_origins', mode='before')
    @classmethod
    def parse_allowed_origins(cls, value: str | list[str]) -> list[str]:
        origins = value.split(',') if isinstance(value, str) else value
        return [origin.strip() for origin in origins if origin.strip()]
