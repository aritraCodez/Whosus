import math
import time
import numpy as np
import pytest
from app.game import Room,GameError,DT,STATIONS,move,walkable
from app.voice import VoiceRouter
from app.models import Message
from pydantic import ValidationError

def game(n=6):
    r=Room('TESTAB')
    for i in range(n): r.add(f'Player {i}',i).ready=True
    r.start(r.host);r.tick(r.now+6)
    return r

def parties(r):
    return next(p for p in r.players.values() if p.role=='impostor'),[p for p in r.players.values() if p.role=='crew']

def test_start_requires_four_ready_players_and_host():
    r=Room('TESTAB');p=r.add('Host')
    with pytest.raises(GameError):r.start(p.id)
    for i in range(3):r.add(str(i))
    with pytest.raises(GameError):r.start(p.id)
    for q in r.players.values():q.ready=True
    with pytest.raises(GameError):r.start(list(r.players)[1])
    r.start(p.id)
    assert r.phase=='reveal'

def test_private_roles_and_hidden_ghost_coordinates():
    r=game();imp,crew=parties(r)
    s=r.snapshot(crew[0].id)
    assert all('role' not in p for p in s['players'] if p['id']!=crew[0].id)
    crew[1].alive=False
    assert crew[1].id not in [p['id'] for p in r.snapshot(crew[0].id)['players']]
    assert crew[1].id in [p['id'] for p in r.snapshot(crew[1].id)['players']]
    imp.vent=0
    assert imp.id not in [p['id'] for p in r.snapshot(crew[0].id)['players']]

def test_server_movement_is_bounded_per_tick_and_no_teleports():
    r=game();p=list(r.players.values())[0];p.x=0;p.z=2
    for seq in range(1,101):r.enqueue(p,seq,1,1,r.round)
    r.tick(r.now+DT)
    assert math.hypot(p.x,p.z-2)==pytest.approx(.21)
    assert len(p.inputs)<=19
    old=(p.x,p.z);r.enqueue(p,1,-1,-1,r.round);assert (p.x,p.z)==old
    queued=list(p.inputs)
    r.enqueue(p,101,0,0,r.round-1)
    assert list(p.inputs)==queued and p.last_seq==100


def test_lobby_inputs_in_flight_at_launch_are_discarded():
    r=Room('TESTAB')
    for i in range(4):r.add(f'Player {i}').ready=True
    p=r.players[r.host]
    old_round=r.round
    r.enqueue(p,1,1,0,old_round)
    r.start(p.id)
    spawn=(p.x,p.z)
    r.enqueue(p,2,1,0,old_round)
    r.enqueue(p,3,1,0,r.round)
    assert not p.inputs and p.last_seq==1
    r.tick(r.deadline)
    assert (p.x,p.z)==spawn
    r.enqueue(p,4,1,0,r.round)
    r.tick(r.now+DT)
    assert p.ack==4 and (p.x,p.z)==move(*spawn,1,0)

def test_collisions_and_ghost_bounds():
    x,z=3.5,3.5
    for _ in range(100):x,z=move(x,z,1,1)
    assert walkable(x,z) and x<4 and z<4
    assert move(13.99,13.99,1,1,True)==(14,14)
    assert not walkable(0,0)

def test_kills_enforce_role_range_cooldown_and_alive():
    r=game();imp,crew=parties(r);q=crew[0]
    with pytest.raises(GameError):r.action(q.id,'kill',crew[1].id)
    imp.x=0;imp.z=2;q.x=0;q.z=2
    with pytest.raises(GameError):r.action(imp.id,'kill',q.id)
    r.now+=30;q.x=12
    with pytest.raises(GameError):r.action(imp.id,'kill',q.id)
    q.x=0;r.action(imp.id,'kill',q.id)
    assert not q.alive and r.bodies[0]['id']==q.id
    with pytest.raises(GameError):r.action(imp.id,'kill',crew[1].id)

def test_tasks_require_distance_nonce_sequence_and_time():
    r=game();imp,crew=parties(r);p=crew[0];s=STATIONS[0]
    with pytest.raises(GameError):r.action(p.id,'task_begin',s['id'])
    p.x=s['x'];p.z=s['z'];r.action(p.id,'task_begin',s['id']);c=p.challenge
    with pytest.raises(GameError):r.action(p.id,'task_step','forged',c['sequence'][0])
    with pytest.raises(GameError):r.action(p.id,'task_step',c['nonce'],c['sequence'][0])
    r.now+=1
    with pytest.raises(GameError):r.action(p.id,'task_step',c['nonce'],(c['sequence'][0]+1)%4)
    for v in c['sequence']:r.now+=.4;r.action(p.id,'task_step',c['nonce'],v)
    assert s['id'] in p.done and p.challenge is None
    imp.x=s['x'];imp.z=s['z']
    with pytest.raises(GameError):r.action(imp.id,'task_begin',s['id'])

def test_ghost_tasks_can_finish_for_crew_win():
    r=game();imp,crew=parties(r);p=crew[0];p.alive=False
    for q in crew:q.done.update(q.tasks)
    p.done.remove('garden');p.x=-12;p.z=-2
    r.action(p.id,'task_begin','garden');c=p.challenge
    for v in c['sequence']:r.now+=.4;r.action(p.id,'task_step',c['nonce'],v)
    assert r.winner=='crew' and r.phase=='gameover'

def test_sabotage_repair_and_expiration():
    r=game();imp,crew=parties(r);r.now+=30;r.action(imp.id,'sabotage')
    with pytest.raises(GameError):r.action(crew[0].id,'repair')
    crew[0].x=2;crew[0].z=-12;r.action(crew[0].id,'repair');assert not r.sabotage_until
    r.now+=85;r.action(imp.id,'sabotage');r.tick(r.now+56);assert r.winner=='impostor'

def test_meetings_votes_skip_and_rematch():
    r=game();imp,crew=parties(r);p=crew[0];r.now+=30;p.x=0;p.z=2;r.action(p.id,'meeting')
    assert r.phase=='discussion'
    with pytest.raises(GameError):r.action(p.id,'vote',imp.id)
    r.tick(r.now+r.discussion+1);assert r.phase=='voting'
    for q in r.players.values():r.action(q.id,'vote',imp.id)
    with pytest.raises(GameError):r.action(p.id,'vote','skip')
    r.tick(r.now+DT);assert r.winner=='crew'
    r.action(r.host,'rematch');assert r.phase=='lobby' and all(q.alive and not q.ready for q in r.players.values())

def test_tied_vote_ejects_nobody():
    r=game(4);ids=list(r.players);r.phase='voting';r.deadline=r.now+30
    for i,pid in enumerate(ids):r.action(pid,'vote',ids[i%2])
    r.tick(r.now+DT);assert r.phase=='results' and all(p.alive for p in r.players.values())

def test_report_requires_a_real_nearby_body():
    r=game();imp,crew=parties(r);imp.x=0;imp.z=2;crew[0].x=0;crew[0].z=2;r.now+=30;r.action(imp.id,'kill',crew[0].id)
    with pytest.raises(GameError):r.action(crew[1].id,'report','fake')
    crew[1].x=12
    with pytest.raises(GameError):r.action(crew[1].id,'report',crew[0].id)
    crew[1].x=0;crew[1].z=2;r.action(crew[1].id,'report',crew[0].id);assert r.phase=='discussion' and not r.bodies

def test_vents_require_impostor_and_range():
    r=game();imp,crew=parties(r)
    with pytest.raises(GameError):r.action(crew[0].id,'vent')
    with pytest.raises(GameError):r.action(imp.id,'vent')
    imp.x=-11;imp.z=0;r.action(imp.id,'vent');assert imp.vent==0
    r.action(imp.id,'vent','next');assert (imp.x,imp.z)==(0,-11)
    r.action(imp.id,'vent');assert imp.vent==-1

def test_chat_permissions_and_rate_limit():
    r=game();imp,crew=parties(r);a,b=crew[:2];a.alive=False
    msg_living=r.add_chat(b.id,'living exploration chat');assert a.id not in msg_living['recipients']
    msg=r.add_chat(a.id,'ghost secret');assert b.id not in msg['recipients']
    with pytest.raises(GameError):r.add_chat(a.id,'spam')
    r.phase='discussion';r.now+=2
    msg=r.add_chat(b.id,'my alibi');assert a.id not in msg['recipients']
    r.phase='gameover';r.now+=2;assert len(r.add_chat(a.id,'hello everyone')['recipients'])==6

@pytest.mark.parametrize('phase',['reveal','playing','discussion','voting','results'])
def test_no_ghost_audio_to_living_in_any_active_phase(phase):
    r=game();imp,crew=parties(r);a,b=crew[:2];a.alive=False;a.muted=b.muted=False;r.phase=phase
    assert r.voice_gain(a.id,b.id)==r.voice_gain(b.id,a.id)==0
    router=VoiceRouter();router.frames[a.id]=(1,time.monotonic(),np.full(960,18000,dtype=np.float32),18000)
    assert not np.any(router.mix(r,b.id,{}))
    b.alive=False;assert np.max(router.mix(r,b.id,{}))==18000

def test_audio_distance_deafen_disconnect_and_live_revocation():
    r=game();a,b=list(r.players.values())[:2];a.muted=b.muted=False;a.x=0;a.z=2;b.x=0;b.z=3
    assert r.voice_gain(a.id,b.id)==1
    b.x=7;assert 0<r.voice_gain(a.id,b.id)<1
    b.x=12;assert r.voice_gain(a.id,b.id)==0
    r.phase='discussion';assert r.voice_gain(a.id,b.id)==1
    b.deafened=True;assert r.voice_gain(a.id,b.id)==0;b.deafened=False
    a.connected=False;assert r.voice_gain(a.id,b.id)==0;a.connected=True
    router=VoiceRouter();router.frames[a.id]=(1,time.monotonic(),np.full(960,10000,dtype=np.float32),10000)
    assert np.any(router.mix(r,b.id,{}))
    a.alive=False
    assert not np.any(router.mix(r,b.id,{})) # same already-established transport, permission revoked

def test_disconnect_grace_then_forfeit():
    r=game();imp,crew=parties(r);imp.connected=False;imp.disconnected_at=r.now
    r.tick(r.now+40);assert imp.alive
    r.tick(r.now+6);assert not imp.alive and r.winner=='crew'

@pytest.mark.parametrize('payload',[{'type':'input','dx':float('nan')},{'type':'input','dx':2},{'type':'action','role':'impostor'},{'type':'chat','text':'x'*281}])
def test_invalid_protocol_payloads(payload):
    with pytest.raises(ValidationError):Message.model_validate(payload)
