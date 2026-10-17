"""Trusted WebRTC audio routing: permissions applied before media leaves server."""
import asyncio
import base64
import hashlib
import hmac
import os
import time
from fractions import Fraction
import numpy as np
from av import AudioFrame, AudioResampler
from aiortc import AudioStreamTrack, RTCConfiguration, RTCIceServer, RTCPeerConnection, RTCSessionDescription
from aiortc.mediastreams import MediaStreamError
from aiortc.sdp import candidate_from_sdp

def ice_config(identity):
    servers = []
    stun = os.getenv('STUN_URL', 'stun:stun.cloudflare.com:3478,stun:stun.l.google.com:19302')
    for url in stun.split(','):
        if url.strip(): servers.append({'urls':url.strip()})
    turn, secret = os.getenv('TURN_URL',''), os.getenv('TURN_SECRET','')
    if turn and secret:
        username = f'{int(time.time())+3600}:{identity}'
        credential = base64.b64encode(hmac.new(secret.encode(),username.encode(),hashlib.sha1).digest()).decode()
        servers.append({'urls':turn.split(','),'username':username,'credential':credential})
    return servers

class AuthorizedMix(AudioStreamTrack):
    def __init__(self, router, room, pid):
        super().__init__()
        self.router, self.room, self.pid = router, room, pid
        self.started = None; self.pts = 0; self.seen = {}

    async def recv(self):
        if self.readyState != 'live': raise MediaStreamError
        now = time.monotonic()
        if self.started is None: self.started = now
        await asyncio.sleep(max(0,self.started+self.pts/48000-now))
        samples = self.router.mix(self.room,self.pid,self.seen)
        frame = AudioFrame.from_ndarray(samples.reshape(1,-1),format='s16',layout='mono')
        frame.sample_rate = 48000; frame.pts = self.pts; frame.time_base = Fraction(1,48000)
        self.pts += 960
        return frame

class VoiceRouter:
    def __init__(self):
        self.peers = {}; self.frames = {}; self.readers = {}; self.generations = {}; self.serial = 0

    def mix(self, room, pid, seen):
        out = np.zeros(960,dtype=np.float32)
        now = time.monotonic()
        for source in tuple(room.players):
            gain = room.voice_gain(source,pid)
            entry = self.frames.get(source)
            if not entry: continue
            seq, at, data, _ = entry
            if gain > 0 and now-at < .15 and seen.get(source) != seq: out += data * gain
            # Advance even when forbidden so a later phase cannot reveal stale speech.
            seen[source] = seq
        return np.clip(out,-32767,32767).astype(np.int16)

    def speaking(self, room, pid):
        return [source for source,(seq,at,data,energy) in self.frames.items() if time.monotonic()-at < .2 and energy > 450 and (room.voice_gain(source,pid) > 0 or source == pid and not room.players[pid].muted)]

    async def consume(self, pid, track, pc):
        resampler = AudioResampler(format='s16',layout='mono',rate=48000,frame_size=960)
        try:
            while self.peers.get(pid) is pc:
                frame = await track.recv()
                for f in resampler.resample(frame):
                    data = f.to_ndarray().reshape(-1).astype(np.float32)
                    if data.size == 960:
                        self.serial += 1
                        self.frames[pid] = (self.serial,time.monotonic(),data,float(np.sqrt(np.mean(data*data))))
        except (MediaStreamError, asyncio.CancelledError): pass
        finally:
            if self.peers.get(pid) is pc: self.frames.pop(pid,None)

    async def offer(self, room, pid, sdp, generation=0):
        await self.close(pid)
        pc = RTCPeerConnection(RTCConfiguration(iceServers=[RTCIceServer(**s) for s in ice_config(pid)]))
        self.peers[pid] = pc
        self.generations[pid] = generation
        @pc.on('track')
        def track_received(track):
            if track.kind == 'audio': self.readers[pid] = asyncio.create_task(self.consume(pid,track,pc))
        @pc.on('connectionstatechange')
        async def state_changed():
            if pc.connectionState == 'failed' and self.peers.get(pid) is pc: await self.close(pid)
        try:
            await pc.setRemoteDescription(RTCSessionDescription(sdp=sdp,type='offer'))
            pc.addTrack(AuthorizedMix(self,room,pid))
            await pc.setLocalDescription(await pc.createAnswer())
            return pc.localDescription.sdp
        except BaseException:
            if self.peers.get(pid) is pc: await self.close(pid)
            raise

    async def add_ice(self, pid, generation, value):
        pc = self.peers.get(pid)
        if not pc or self.generations.get(pid) != generation: return
        if value is None or not value.get('candidate'):
            await pc.addIceCandidate(None)
            return
        try:
            candidate = candidate_from_sdp(value['candidate'].removeprefix('candidate:'))
            candidate.sdpMid = value.get('sdpMid')
            candidate.sdpMLineIndex = value.get('sdpMLineIndex')
            if candidate.sdpMid is None and candidate.sdpMLineIndex is None:
                raise ValueError('Missing ICE media channel')
        except (AssertionError,IndexError,KeyError,TypeError,ValueError) as error:
            raise ValueError('Invalid ICE candidate') from error
        await pc.addIceCandidate(candidate)

    async def close(self, pid):
        task = self.readers.pop(pid,None)
        if task: task.cancel()
        pc = self.peers.pop(pid,None)
        self.generations.pop(pid,None)
        self.frames.pop(pid,None)
        if pc: await pc.close()

    async def shutdown(self):
        await asyncio.gather(*(self.close(pid) for pid in list(self.peers)))
