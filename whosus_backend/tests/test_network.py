from contextlib import ExitStack
from fastapi.testclient import TestClient
from app.main import app

ORIGIN={'origin':'http://localhost:5173'}
def until(ws,kind):
    for _ in range(100):
        m=ws.receive_json()
        if m['type']==kind:return m
    raise AssertionError(f'No {kind} message')

def test_four_clients_chat_role_secrecy_and_resume():
    with TestClient(app) as client, ExitStack() as stack:
        sockets=[stack.enter_context(client.websocket_connect('/ws',headers=ORIGIN)) for _ in range(4)]
        sockets[0].send_json({'type':'create','name':'Host','public':True})
        identities=[until(sockets[0],'joined')]
        room=until(sockets[0],'snapshot')['room'];code=room['code']
        assert client.get('/api/rooms').json()[0]['code']==code
        for i,ws in enumerate(sockets[1:]):
            ws.send_json({'type':'join','code':code,'name':f'Crew{i}'})
            identities.append(until(ws,'joined'))
        sockets[0].send_json({'type':'chat','text':'hello crew'})
        for ws in sockets:assert until(ws,'chat')['message']['text']=='hello crew'
        for ws in sockets:ws.send_json({'type':'action','action':'ready'})
        # Wait until host sees every ready state before launching.
        for _ in range(100):
            room=until(sockets[0],'snapshot')['room']
            if len(room['players'])==4 and all(p['ready'] for p in room['players']):break
        sockets[0].send_json({'type':'action','action':'start'})
        for ws,identity in zip(sockets,identities):
            for _ in range(100):
                room=until(ws,'snapshot')['room']
                if room['phase']=='reveal':break
            assert sum('role' in p for p in room['players'])==1
            assert next(p for p in room['players'] if p['id']==identity['id'])['role'] in ('crew','impostor')
        sockets[2].close()
        resumed=stack.enter_context(client.websocket_connect('/ws',headers=ORIGIN))
        resumed.send_json({'type':'resume','token':identities[2]['token']})
        assert until(resumed,'joined')['id']==identities[2]['id']
        assert until(resumed,'snapshot')['room']['code']==code
        forged=stack.enter_context(client.websocket_connect('/ws',headers=ORIGIN))
        forged.send_json({'type':'resume','token':'not-a-token'})
        assert until(forged,'expired')

def test_unknown_rooms_and_server_validation():
    with TestClient(app) as client, client.websocket_connect('/ws',headers=ORIGIN) as ws:
        ws.send_json({'type':'join','code':'XXXXXX'})
        assert 'No room' in until(ws,'error')['message']
        ws.send_json({'type':'create','name':'Host','capacity':500})
        assert until(ws,'error')['message']=='Invalid request.'
        ws.send_json({'type':'create','name':'Host'})
        until(ws,'joined');ws.send_json({'type':'action','action':'start'})
        assert 'four' in until(ws,'error')['message']
