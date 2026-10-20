import logging
import re
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from .voice import VoiceRouter


log = logging.getLogger('whosus')


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    allowed_origins: Annotated[list[str], NoDecode]
    # STUN servers come only from STUN_URL; unset/empty means local ICE only.
    stun_url: Annotated[list[str], NoDecode] = []

    @field_validator('stun_url', mode='before')
    @classmethod
    def parse_ice_urls(cls, value: str | list[str]) -> list[str]:
        urls = value.replace(';', ',').split(',') if isinstance(value, str) else value
        return [url.strip() for url in urls if url.strip()]

    @field_validator('stun_url')
    @classmethod
    def validate_ice_urls(cls, urls):
        for url in urls:
            if not re.fullmatch(r'stun:(?:\[[0-9a-fA-F:]+\]|[^\s:/?#]+)(?::[0-9]{1,5})?', url):
                raise ValueError('STUN_URL requires valid stun: URLs')
        return urls

    @field_validator('allowed_origins', mode='before')
    @classmethod
    def parse_allowed_origins(cls, value: str | list[str]) -> list[str]:
        origins = value.replace(';', ',').split(',') if isinstance(value, str) else value
        return [origin.strip() for origin in origins if origin.strip()]


settings = Settings()
rooms = {}
sessions = {}
voice = VoiceRouter(stun_urls=settings.stun_url)
ORIGINS = set(settings.allowed_origins)
