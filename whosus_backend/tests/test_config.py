from app.config import Settings
from app.voice import DEFAULT_STUN_URLS, VoiceRouter


def test_allowed_origins_are_split_trimmed_and_empty_values_removed():
    settings = Settings(allowed_origins='https://game.example, , http://localhost:5173 ')

    assert settings.allowed_origins == ['https://game.example', 'http://localhost:5173']


def test_stun_urls_use_defaults_and_ignore_environment(monkeypatch):
    monkeypatch.setenv('STUN_URL', 'stun:first.example:3478;stun:second.example:3478')

    assert VoiceRouter().stun_urls == DEFAULT_STUN_URLS
