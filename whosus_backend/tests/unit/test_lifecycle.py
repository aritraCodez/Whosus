import asyncio

import pytest

from app.features.game.service import Room
from app.features.voice.service import VoiceService
from app.runtime import Runtime, Session
from app.services.simulation import tick


def test_expiry_removes_empty_rooms_and_their_tokens():
    runtime = Runtime(voice=VoiceService())
    room = Room("EXPIRE")
    player = room.add("Host")
    player.connected = False
    player.disconnected_at = room.now
    runtime.rooms[room.code] = room
    runtime.sessions["token"] = Session(room, player.id, "token")
    tick(runtime, room.now + 89)
    assert runtime.rooms and runtime.sessions
    tick(runtime, room.now + 2)
    assert not runtime.rooms and not runtime.sessions


@pytest.mark.asyncio
async def test_shutdown_clears_runtime_when_lifespan_body_raises(application):
    runtime = application.state.runtime
    with pytest.raises(RuntimeError, match="test failure"):
        async with application.router.lifespan_context(application):
            room = Room("TEMPOR")
            player = room.add("Host")
            runtime.rooms[room.code] = room
            runtime.sessions["temporary"] = Session(room, player.id, "temporary")
            runtime.voice.state(player.id, True, True)
            raise RuntimeError("test failure")
    assert not runtime.rooms and not runtime.sessions
    assert not runtime.voice.enabled and not runtime.voice.talking


@pytest.mark.asyncio
async def test_simulation_failure_marks_health_and_still_cleans_up(application, monkeypatch):
    async def fail(runtime):
        raise RuntimeError("simulation fault")

    monkeypatch.setattr("app.main.simulate", fail)
    runtime = application.state.runtime
    with pytest.raises(RuntimeError, match="simulation fault"):
        async with application.router.lifespan_context(application):
            room = Room("FAILED")
            runtime.rooms[room.code] = room
            for _ in range(3):
                await asyncio.sleep(0)
            assert runtime.simulation_failed
    assert not runtime.rooms and not runtime.sessions
