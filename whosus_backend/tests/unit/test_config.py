import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.features.voice.service import VoiceService


def test_allowed_origins_are_split_trimmed_and_empty_values_removed():
    settings = Settings(allowed_origins="https://game.example, , http://localhost:5173 ")

    assert settings.allowed_origins == ["https://game.example", "http://localhost:5173"]


def test_stun_environment_reaches_router_and_browser_ice_configuration(monkeypatch):
    monkeypatch.setenv("STUN_URL", " stun:first.example:3478; stun:second.example:3478 ")
    settings = Settings()
    router = VoiceService(stun_urls=settings.stun_url)
    assert settings.stun_url == ["stun:first.example:3478", "stun:second.example:3478"]
    assert router.ice_servers == [
        {"urls": "stun:first.example:3478"},
        {"urls": "stun:second.example:3478"},
    ]


def test_missing_stun_environment_does_not_inject_hardcoded_servers(monkeypatch):
    monkeypatch.delenv("STUN_URL", raising=False)
    settings = Settings(_env_file=None, allowed_origins="http://localhost:5173")
    assert settings.stun_url == []
    assert VoiceService().ice_servers == []


def test_explicitly_empty_stun_environment_disables_external_discovery(monkeypatch):
    monkeypatch.setenv("STUN_URL", "")
    assert Settings().stun_url == []


@pytest.mark.parametrize(
    "url", ["https://relay.example", "turn:relay.example", "stun:relay.example?transport=tcp"]
)
def test_invalid_stun_configuration_is_rejected(url):
    with pytest.raises(ValidationError):
        Settings(stun_url=url)
