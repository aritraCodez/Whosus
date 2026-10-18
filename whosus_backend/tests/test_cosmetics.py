from contextlib import ExitStack

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.cosmetics import COSMETICS
from app.game import GameError, Room
from app.main import app
from app.models import Message


@pytest.mark.parametrize('slot,items', COSMETICS.items())
def test_catalog_items_can_be_equipped_and_shared(slot, items):
    room = Room('DRESS')
    player, witness = room.add('Host'), room.add('Guest')
    for item in items:
        Message(type='join', **{slot: item})
        room.action(player.id, 'customize', slot, item)
        public = next(p for p in room.snapshot(witness.id)['players'] if p['id'] == player.id)
        assert public[slot] == item


def test_unknown_items_and_non_cosmetic_fields_cannot_be_equipped():
    room = Room('DRESS')
    player = room.add('Host')
    for slot, value in [('hat', 'missing'), ('role', 'killer'), ('alive', False), ('outfit', None)]:
        with pytest.raises(GameError):
            room.action(player.id, 'customize', slot, value)
    assert player.role == 'crew' and player.alive and player.hat == 'sprout'
    with pytest.raises(ValidationError):
        Message(type='create', outfit='missing')
    with pytest.raises(GameError):
        room.add('Invalid', hat='missing')


@pytest.mark.parametrize('phase', ['reveal', 'playing', 'meeting', 'gameover'])
def test_clothing_locked_after_launch(phase):
    room = Room('DRESS')
    player = room.add('Host', outfit='dress', hat='crown')
    room.phase = phase
    with pytest.raises(GameError):
        room.action(player.id, 'customize', 'outfit', 'lab')
    assert player.outfit == 'dress'


def until(ws, kind, predicate=lambda _: True):
    for _ in range(100):
        message = ws.receive_json()
        if message['type'] == kind and predicate(message):
            return message
    raise AssertionError(f'Missing {kind}')


def test_create_join_live_changes_and_resume_keep_full_appearance():
    with TestClient(app) as client, ExitStack() as stack:
        connect = lambda: stack.enter_context(client.websocket_connect('/ws', headers={'origin': 'http://localhost:5173'}))
        host, guest = connect(), connect()
        look = dict(hat='wizard', outfit='dress', visor='glasses', accessory='wings', boots='gold')
        host.send_json(dict(type='create', name='Dressed host', **look))
        identity = until(host, 'joined')
        snapshot = until(host, 'snapshot')['room']
        assert all(snapshot['players'][0][slot] == value for slot, value in look.items())
        guest.send_json(dict(type='join', name='Guest', code=snapshot['code'], outfit='lab', hat='beanie'))
        guest_id = until(guest, 'joined')['id']
        host.send_json(dict(type='action', action='customize', target='outfit', value='captain'))
        snapshot = until(guest, 'snapshot', lambda m: any(p['id'] == identity['id'] and p['outfit'] == 'captain' for p in m['room']['players']))['room']
        assert next(p for p in snapshot['players'] if p['id'] == guest_id)['outfit'] == 'lab'
        host.close()
        resumed = connect()
        resumed.send_json(dict(type='resume', token=identity['token']))
        assert until(resumed, 'joined')['id'] == identity['id']
        player = next(p for p in until(resumed, 'snapshot')['room']['players'] if p['id'] == identity['id'])
        assert player['outfit'] == 'captain' and player['hat'] == 'wizard' and player['boots'] == 'gold'
