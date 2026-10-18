import pytest

from app.game import ARRIVAL_SEAT_TIME, DT, GameError, LOBBY_SEATS, Room, move


def test_all_twelve_arrivals_get_distinct_seats_then_automatically_stand():
    room = Room('CHAIRS', capacity=12)
    players = [room.add(f'Guest {i}') for i in range(12)]
    assert {p.seat for p in players} == set(range(12))
    assert all((p.x, p.z) == LOBBY_SEATS[p.seat] for p in players)
    assert len({p['seat'] for p in room.snapshot(players[0].id)['players']}) == 12
    room.tick(room.now + ARRIVAL_SEAT_TIME - .01)
    assert all(p.seat >= 0 for p in players)
    room.tick(room.now + .02)
    assert all(p.seat == -1 and p.seated_until == 0 for p in players)
    assert all(move(p.x, p.z, 0, 0, lobby=True) == (p.x, p.z) for p in players)


def test_manual_sitting_is_shared_and_waits_for_stand_or_movement():
    room = Room('CHAIRS')
    player, witness = room.add('Host'), room.add('Guest')
    room.tick(room.now + ARRIVAL_SEAT_TIME)
    room.action(player.id, 'sit', value=0)
    room.tick(room.now + 10)
    assert next(p for p in room.snapshot(witness.id)['players'] if p['id'] == player.id)['seat'] == 0
    room.action(player.id, 'stand')
    assert player.seat == -1
    room.action(player.id, 'sit', value=0)
    room.enqueue(player, 1, 1, 0, room.round)
    room.tick(room.now + DT)
    assert player.seat == -1 and player.x > -4.85


def test_chairs_enforce_distance_occupancy_and_valid_ids():
    room = Room('CHAIRS')
    a, b = room.add('Host'), room.add('Guest')
    room.action(a.id, 'stand')
    for value in (-1, 12, True, '0', None):
        with pytest.raises(GameError): room.action(a.id, 'sit', value=value)
    with pytest.raises(GameError): room.action(a.id, 'sit', value=11)
    a.x, a.z = b.x + .4, b.z
    with pytest.raises(GameError, match='occupied'): room.action(a.id, 'sit', value=b.seat)
    a.x, a.z = -4.85, -3.75
    room.action(a.id, 'sit', value=0)
    with pytest.raises(GameError, match='already sitting'): room.action(a.id, 'sit', value=0)


def test_disconnection_releases_a_seat_and_launch_clears_seating():
    room = Room('CHAIRS')
    players = [room.add(str(i)) for i in range(4)]
    players[0].connected = False
    room.tick(room.now + DT)
    assert players[0].seat == -1
    players[0].connected = True
    for p in players: p.ready = True
    room.start(room.host)
    assert all(p.seat == -1 and p.seated_until == 0 for p in players)
    with pytest.raises(GameError): room.action(players[0].id, 'sit', value=0)


def test_removed_box_space_is_walkable_but_wardrobe_stays_solid():
    assert move(-3.6, -.7, 1, 0, lobby=True)[0] > -3.6
    assert move(2.3, -.7, 1, 0, lobby=True) == (2.3, -.7)
