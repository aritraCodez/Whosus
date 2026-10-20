import os
from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:
    from fastapi import FastAPI

os.environ["ALLOWED_ORIGINS"] = "http://localhost:5173"


@pytest.fixture
def application() -> "FastAPI":
    from app.core.config import Settings
    from app.main import create_app

    return create_app(
        Settings(_env_file=None, allowed_origins=["http://localhost:5173"], stun_url=[])
    )
