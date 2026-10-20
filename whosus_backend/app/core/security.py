import time
from dataclasses import dataclass, field

from .limits import RATE_BURST, RATE_PER_SECOND


def clean_text(value: str) -> str:
    """Retain the existing printable-character policy for names and chat."""
    return "".join(c for c in value.strip() if c.isprintable())


@dataclass
class TokenBucket:
    tokens: float = RATE_BURST
    updated_at: float = field(default_factory=time.monotonic)

    def consume(self, now: float) -> bool:
        self.tokens = min(RATE_BURST, self.tokens + (now - self.updated_at) * RATE_PER_SECOND)
        self.updated_at = now
        if self.tokens < 1:
            return False
        self.tokens -= 1
        return True
