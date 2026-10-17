"""Actual ICE/DTLS/Opus transport test, including revocation on an existing connection."""
import asyncio
import time
from fractions import Fraction
import numpy as np
import pytest
from av import AudioFrame
from aiortc import AudioStreamTrack,RTCPeerConnection,RTCConfiguration,RTCSessionDescription
from app.game import Room
from app.voice import VoiceRouter

class Tone(AudioStreamTrack):
    def __init__(self):super().__init__();self.pts=0;self.start=None
    async def recv(self):
        if self.start is None:self.start=time.monotonic()
        await asyncio.sleep(max(0,self.start+self.pts/48000-time.monotonic()))
        values=(np.sin((np.arange(960)+self.pts)/48000*2*np.pi*440)*8000).astype(np.int16)
        f=AudioFrame.from_ndarray(values.reshape(1,-1),format='s16',layout='mono');f.sample_rate=48000;f.time_base=Fraction(1,48000);f.pts=self.pts;self.pts+=960;return f

@pytest.mark.asyncio
async def test_live_media_permissions(monkeypatch):
    monkeypatch.setenv('STUN_URL','');monkeypatch.setenv('TURN_URL','')
    r=Room('AUDIOX');a=r.add('Alice');b=r.add('Bob');a.muted=b.muted=False
    router=VoiceRouter();clients=[];readers=[];energy=[]
    async def receive(track):
        try:
            while True:
                frame=await track.recv();data=frame.to_ndarray().astype(np.float32);energy.append(float(np.sqrt(np.mean(data*data))))
        except asyncio.CancelledError:pass
    try:
        for p in (a,b):
            pc=RTCPeerConnection(RTCConfiguration(iceServers=[]));clients.append(pc);pc.addTrack(Tone())
            if p is b:
                @pc.on('track')
                def on_track(track):readers.append(asyncio.create_task(receive(track)))
            await pc.setLocalDescription(await pc.createOffer());answer=await router.offer(r,p.id,pc.localDescription.sdp)
            await pc.setRemoteDescription(RTCSessionDescription(sdp=answer,type='answer'))
        async def settled():
            await asyncio.sleep(.65);energy.clear();await asyncio.sleep(.35)
            assert len(energy)>5,'Media transport must keep delivering audio frames'
            return max(energy)
        assert await settled()>1000
        r.phase='playing';a.alive=False
        assert await settled()<10,'Existing connection must no longer carry ghost speech to living Bob'
        b.alive=False
        assert await settled()>1000,'Ghosts must hear other ghosts'
        b.deafened=True
        assert await settled()<10
        b.deafened=False;a.alive=b.alive=True;a.x=13;b.x=0
        assert await settled()<10,'Distant living players must not receive audio'
        r.phase='discussion'
        assert await settled()>1000,'Meetings override proximity for living players'
        a.alive=False
        assert await settled()<10,'Meetings must still exclude ghosts'
        r.phase='gameover'
        assert await settled()>1000
    finally:
        for task in readers:task.cancel()
        await asyncio.gather(*readers,return_exceptions=True)
        await asyncio.gather(*(pc.close() for pc in clients));await router.shutdown()
