import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core.security import TokenBucket, clean_text


def test_bucket_preserves_burst_refill_and_ceiling():
    bucket = TokenBucket(updated_at=10)
    assert all(bucket.consume(10) for _ in range(100))
    assert not bucket.consume(10)
    assert bucket.consume(10.1)
    assert 3 < bucket.tokens < 4
    assert bucket.consume(1000)
    assert bucket.tokens == 99


def test_printable_policy_preserves_names_and_removes_controls():
    assert clean_text("  Explorer\x00\n One  ") == "Explorer One"
    assert clean_text("  \n  ") == ""


@pytest.mark.parametrize(
    "origin",
    [
        "*",
        "null",
        "https://*.example",
        "https://user:pass@example.com",
        "https://example.com/path",
        "https://example.com/",
        "https://example.com?q=secret",
        "https://example.com#fragment",
        "http://localhost:0",
        "http://localhost:99999",
    ],
)
def test_invalid_origins_fail_closed(origin):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, allowed_origins=[origin])


@pytest.mark.parametrize("url", ["stun:host:0", "stun:host:65536", "stun:[::::]:3478"])
def test_invalid_discovery_address_or_port_fails_configuration(url):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, allowed_origins=["https://game.example"], stun_url=[url])
