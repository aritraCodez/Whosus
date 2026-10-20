import ipaddress
import re
from typing import Annotated
from urllib.parse import urlsplit

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    allowed_origins: Annotated[list[str], NoDecode]
    stun_url: Annotated[list[str], NoDecode] = Field(default_factory=list)

    @field_validator("allowed_origins", "stun_url", mode="before")
    @classmethod
    def split_urls(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.replace(";", ",").split(",") if item.strip()]
        return value

    @field_validator("allowed_origins")
    @classmethod
    def validate_origins(cls, values: list[str]) -> list[str]:
        origins = [value.strip() for value in values if value.strip()]
        for origin in origins:
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in ("http", "https")
                or not parsed.hostname
                or parsed.username is not None
                or parsed.password is not None
                or parsed.path
                or parsed.query
                or parsed.fragment
                or "*" in origin
                or any(c.isspace() for c in origin)
            ):
                raise ValueError(
                    "ALLOWED_ORIGINS requires exact HTTP(S) origins without paths or credentials"
                )
            if parsed.port == 0:
                raise ValueError("ALLOWED_ORIGINS requires a valid port")
        return origins

    @field_validator("stun_url")
    @classmethod
    def validate_ice_urls(cls, values: list[str]) -> list[str]:
        urls = [value.strip() for value in values if value.strip()]
        for url in urls:
            match = re.fullmatch(r"stun:(\[[0-9a-fA-F:]+\]|[^\s:/?#]+)(?::([0-9]{1,5}))?", url)
            if not match:
                raise ValueError("STUN_URL requires valid stun: URLs")
            host, port = match.groups()
            if host.startswith("["):
                ipaddress.IPv6Address(host[1:-1])
            if port is not None and not 1 <= int(port) <= 65535:
                raise ValueError("STUN_URL requires a valid port")
        return urls
