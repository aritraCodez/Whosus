from app.config import Settings


def test_allowed_origins_are_split_trimmed_and_empty_values_removed():
    settings = Settings(allowed_origins='https://game.example, , http://localhost:5173 ')

    assert settings.allowed_origins == ['https://game.example', 'http://localhost:5173']
