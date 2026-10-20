import { useGame } from "@/features/game/model/game-store";
import { send } from "@/services/game-socket";

import type { Peer, VoicePeer, VoiceSignal, Watch } from "./types";
/** One WebRTC audio connection per player, with room-scoped WebSocket signaling. */
export class VoiceChat {
  private peers = new Map<string, Peer>();
  private allowed = new Map<string, VoicePeer>();
  private pending = new Map<
    string,
    { generation: number; candidates: (RTCIceCandidateInit | null)[] }
  >();
  private latest = new Map<string, number>();
  private early = new Map<string, { at: number; signals: VoiceSignal[] }>();
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private watches = new Map<string, Watch>();
  private ice: RTCIceServer[] = [];
  private wanted = false;
  private failed = false;
  private generation = 0;
  private call = Date.now();
  private enabling: Promise<boolean> | null = null;
  private detach: (() => void) | null = null;
  private meter?: ReturnType<typeof setInterval>;

  configure(servers: RTCIceServer[]) {
    this.ice = servers;
  }

  attach() {
    if (this.detach) return this.detach;
    const stop = () => this.ptt(false);
    const hidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("pointerdown", this.resume);
    window.addEventListener("keydown", this.resume);
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", hidden);
    this.detach = () => {
      window.removeEventListener("pointerdown", this.resume);
      window.removeEventListener("keydown", this.resume);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", hidden);
      this.detach = null;
    };
    return this.detach;
  }

  enable(openMic = true): Promise<boolean> {
    this.unlock();
    if (this.enabling) return this.enabling;
    const state = useGame.getState();
    if (!state.room || !state.id || state.status !== "connected") {
      useGame.setState({
        voiceError: "Join an expedition before enabling voice.",
      });
      return Promise.resolve(false);
    }
    this.wanted = true;
    this.failed = false;
    const task = this.enableMic(openMic);
    this.enabling = task;
    void task.finally(() => {
      if (this.enabling === task) this.enabling = null;
    });
    return task;
  }

  private async enableMic(openMic: boolean) {
    const generation = this.generation;
    useGame.setState({ voiceStatus: "connecting", voiceError: "" });
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Microphone access needs HTTPS or localhost.");
      if (
        !this.stream
          ?.getAudioTracks()
          .some((track) => track.readyState === "live")
      ) {
        this.stream?.getTracks().forEach((track) => track.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        if (generation !== this.generation || !this.wanted) {
          stream.getTracks().forEach((track) => track.stop());
          return false;
        }
        this.stream = stream;
        this.watch("local", stream);
        stream.getAudioTracks()[0].onended = () => {
          if (this.stream === stream)
            this.fail(
              "Microphone disconnected. Reconnect it and tap the microphone to retry.",
            );
        };
      }
      useGame.setState({ muted: !openMic });
      if (!this.meter) this.meter = setInterval(() => this.apply(), 250);
      // Retry explicitly failed links without replacing healthy peer connections.
      for (const [id, peer] of this.peers) if (peer.failed) this.restart(id);
      this.apply();
      this.sync([...this.allowed.values()]);
      this.updateStatus();
      this.resume();
      return true;
    } catch (error) {
      if (generation === this.generation) this.fail(this.describe(error));
      return false;
    }
  }

  sync(values: VoicePeer[]) {
    this.allowed = new Map(values.map((value) => [value.id, value]));
    for (const id of this.peers.keys())
      if (!this.allowed.has(id)) this.closePeer(id);
    for (const id of this.pending.keys())
      if (!this.allowed.has(id)) this.pending.delete(id);
    if (
      !this.wanted ||
      this.failed ||
      !this.stream ||
      useGame.getState().status !== "connected"
    )
      return;
    // A forwarded signal can beat the first policy snapshot on another socket.
    for (const [id, queued] of this.early) {
      if (Date.now() - queued.at > 5000) this.early.delete(id);
      else if (this.allowed.has(id)) {
        this.early.delete(id);
        for (const signal of queued.signals) void this.signal(signal);
      }
    }
    for (const [id, policy] of this.allowed) {
      const peer = this.peers.get(id);
      if (peer) this.applyPeer(peer, policy);
      else if (this.caller(id)) void this.offer(id);
    }
    this.updateStatus();
  }

  private caller(id: string) {
    return useGame.getState().id < id;
  }

  private createPeer(
    id: string,
    generation: number,
    deadline = Date.now() + 25000,
  ) {
    if (this.failed || !this.context || !this.stream || !this.allowed.has(id))
      return null;
    if (typeof RTCPeerConnection !== "function")
      throw new Error("Voice chat needs a browser with WebRTC support.");
    this.closePeer(id);
    const pc = new RTCPeerConnection({ iceServers: this.ice });
    const source = this.context.createMediaStreamSource(this.stream);
    const gate = this.context.createGain();
    const destination = this.context.createMediaStreamDestination();
    // Silence a disallowed direction before attaching its microphone to WebRTC.
    gate.gain.value = 0;
    source.connect(gate);
    gate.connect(destination);
    const audio = new Audio();
    audio.autoplay = true;
    audio.setAttribute("playsinline", "");
    const peer: Peer = {
      pc,
      generation,
      source,
      gate,
      destination,
      audio,
      queue: [],
      signals: Promise.resolve(),
      blocked: false,
      failed: false,
      deadline,
    };
    this.peers.set(id, peer);
    this.applyPeer(peer, this.allowed.get(id)!);
    const current = () => this.peers.get(id) === peer;
    pc.onicecandidate = (event) => {
      if (current())
        this.sendSignal(id, peer, {
          kind: "ice",
          candidate: event.candidate?.toJSON() ?? null,
        });
    };
    pc.ontrack = (event) => {
      if (!current()) return;
      const media = event.streams[0] ?? new MediaStream([event.track]);
      audio.srcObject = media;
      this.watch(id, media);
      event.track.onunmute = () => {
        if (current()) this.resume();
      };
      this.resume();
    };
    pc.onconnectionstatechange = () => {
      if (!current()) return;
      if (pc.connectionState === "connected") {
        clearTimeout(peer.retry);
        clearTimeout(peer.timeout);
        peer.deadline = 0;
        useGame.setState({ voiceError: "" });
        this.updateStatus();
        this.resume();
      } else if (["disconnected", "failed"].includes(pc.connectionState)) {
        useGame.setState({ voiceStatus: "reconnecting" });
        clearTimeout(peer.retry);
        peer.retry = setTimeout(() => {
          if (current()) this.restart(id);
        }, 4000);
      }
    };
    peer.timeout = setTimeout(
      () => {
        if (current() && pc.connectionState !== "connected") {
          peer.failed = true;
          this.releasePeer(id, peer);
          useGame.setState({
            voiceError:
              "Could not connect to a player's voice. Check your network and tap the microphone to retry.",
          });
          this.updateStatus();
        }
      },
      Math.max(0, deadline - Date.now()),
    );
    this.updateStatus();
    return peer;
  }

  private sendSignal(id: string, peer: Peer, data: Record<string, unknown>) {
    return send({
      type: "voice_signal",
      to: id,
      generation: peer.generation,
      ...data,
    });
  }

  private async offer(id: string, deadline?: number) {
    let peer: Peer | null = null;
    try {
      peer = this.createPeer(id, ++this.call, deadline);
      if (!peer) return;
      peer.pc.addTransceiver(peer.destination.stream.getAudioTracks()[0], {
        direction: "sendrecv",
      });
      await peer.pc.setLocalDescription(await peer.pc.createOffer());
      if (this.peers.get(id) === peer)
        this.sendSignal(id, peer, {
          kind: "offer",
          sdp: peer.pc.localDescription!.sdp,
        });
    } catch (error) {
      if (peer && this.peers.get(id) === peer) this.peerError(id, peer, error);
      else if (!peer) this.fail(this.describe(error));
    }
  }

  signal(message: VoiceSignal) {
    const id = message.from;
    if (!this.wanted || !this.stream || this.failed) return Promise.resolve();
    if (!this.allowed.has(id)) {
      if (this.early.has(id) || this.early.size < 12) {
        const queued = this.early.get(id) ?? { at: Date.now(), signals: [] };
        if (queued.signals.length < 66) queued.signals.push(message);
        this.early.set(id, queued);
      }
      return Promise.resolve();
    }
    if (message.kind === "reset") {
      const peer = this.peers.get(id);
      if (this.caller(id) && peer?.generation === message.generation) {
        const deadline = peer.deadline || Date.now() + 25000;
        void this.offer(id, deadline);
      }
      return Promise.resolve();
    }
    let peer = this.peers.get(id);
    if (message.kind === "offer") {
      // Stable ID ordering chooses one caller, avoiding simultaneous offers.
      if (this.caller(id) || message.generation <= (this.latest.get(id) ?? -1))
        return Promise.resolve();
      this.latest.set(id, message.generation);
      try {
        peer = this.createPeer(id, message.generation) ?? undefined;
      } catch (error) {
        this.fail(this.describe(error));
        return Promise.resolve();
      }
      const pending = this.pending.get(id);
      if (peer && pending?.generation === message.generation)
        peer.queue = pending.candidates;
      this.pending.delete(id);
    }
    if (!peer || peer.generation !== message.generation) {
      // Trickle ICE can precede the caller's SDP, since gathering is immediate.
      if (
        message.kind === "ice" &&
        !this.caller(id) &&
        message.generation > (this.latest.get(id) ?? -1)
      ) {
        let pending = this.pending.get(id);
        if (!pending || message.generation > pending.generation) {
          pending = { generation: message.generation, candidates: [] };
          this.pending.set(id, pending);
        }
        if (
          pending.generation === message.generation &&
          pending.candidates.length < 64
        )
          pending.candidates.push(message.candidate ?? null);
      }
      return Promise.resolve();
    }
    const current = peer;
    current.signals = current.signals
      .then(async () => {
        if (this.peers.get(id) !== current || current.failed) return;
        const pc = current.pc;
        if (message.kind === "ice") {
          if (!pc.remoteDescription) {
            if (current.queue.length < 64)
              current.queue.push(message.candidate ?? null);
          } else await pc.addIceCandidate(message.candidate ?? undefined);
        } else if (message.kind === "offer") {
          await pc.setRemoteDescription({ type: "offer", sdp: message.sdp });
          const channel = pc
            .getTransceivers()
            .find((item) => item.receiver.track.kind === "audio");
          if (!channel) throw new Error("Voice offer has no audio channel.");
          channel.direction = "sendrecv";
          await channel.sender.replaceTrack(
            current.destination.stream.getAudioTracks()[0],
          );
          await this.flush(current);
          await pc.setLocalDescription(await pc.createAnswer());
          if (this.peers.get(id) === current)
            this.sendSignal(id, current, {
              kind: "answer",
              sdp: pc.localDescription!.sdp,
            });
        } else if (
          message.kind === "answer" &&
          this.caller(id) &&
          pc.signalingState === "have-local-offer"
        ) {
          await pc.setRemoteDescription({ type: "answer", sdp: message.sdp });
          await this.flush(current);
        }
      })
      .catch((error) => {
        if (this.peers.get(id) === current) this.peerError(id, current, error);
      });
    return current.signals;
  }

  private async flush(peer: Peer) {
    for (const candidate of peer.queue.splice(0))
      await peer.pc.addIceCandidate(candidate ?? undefined);
  }

  private restart(id: string) {
    const peer = this.peers.get(id);
    if (!peer || !this.allowed.has(id)) return;
    const deadline = peer.failed
      ? undefined
      : peer.deadline || Date.now() + 25000;
    if (this.caller(id)) void this.offer(id, deadline);
    else {
      this.sendSignal(id, peer, { kind: "reset" });
      this.closePeer(id);
    }
  }

  async reconnect() {
    if (
      !this.wanted ||
      !this.stream ||
      useGame.getState().status !== "connected"
    )
      return;
    this.generation++;
    for (const id of [...this.peers.keys()]) this.restart(id);
    this.apply();
    this.sync([...this.allowed.values()]);
  }

  mute() {
    if (useGame.getState().voiceStatus === "error") void this.enable(true);
    else this.setMuted(!useGame.getState().muted);
  }
  setMuted(muted: boolean) {
    this.unlock();
    if (
      !muted &&
      (!this.stream || useGame.getState().voiceStatus === "error")
    ) {
      void this.enable(true);
      return;
    }
    useGame.setState({ muted });
    this.apply();
  }
  ptt(held: boolean) {
    this.setPtt(held);
  }
  setPtt(held: boolean) {
    if (useGame.getState().ptt === held) return;
    useGame.setState({ ptt: held });
    if (held) this.unlock();
    if (held && (!this.stream || useGame.getState().voiceStatus === "error"))
      void this.enable(false);
    else this.apply();
  }
  deafen() {
    this.setDeafened(!useGame.getState().deafened);
  }
  setDeafened(deafened: boolean) {
    useGame.setState({ deafened });
    for (const [id, peer] of this.peers)
      this.applyPeer(peer, this.allowed.get(id));
    this.apply();
    if (!deafened) this.resume();
  }

  private apply() {
    const state = useGame.getState();
    const enabled = this.wanted && !!this.stream && !this.failed;
    const muted = (state.muted && !state.ptt) || state.deafened || !enabled;
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    for (const [id, peer] of this.peers)
      this.applyPeer(peer, this.allowed.get(id));
    send({
      type: "voice_state",
      enabled,
      muted,
      deafened: state.deafened,
      talking: !muted && this.level("local") > 0.014,
    });
  }

  private applyPeer(peer: Peer, policy?: VoicePeer) {
    peer.gate.gain.value =
      policy && policy.sendGain > 0 && !useGame.getState().deafened ? 1 : 0;
    peer.audio.volume = Math.max(0, Math.min(1, policy?.gain ?? 0));
    peer.audio.muted =
      useGame.getState().deafened || !policy || policy.gain <= 0;
  }

  private unlock() {
    if (typeof AudioContext === "function" && !this.context)
      this.context = new AudioContext();
    this.resume();
  }
  resume = () => {
    if (this.context?.state === "suspended")
      void this.context.resume().catch(() => {});
    for (const [id, peer] of this.peers) {
      if (!peer.audio.srcObject || (!peer.audio.paused && !peer.blocked))
        continue;
      void peer.audio
        .play()
        .then(() => {
          if (this.peers.get(id) === peer) {
            peer.blocked = false;
            this.updatePlayback();
          }
        })
        .catch((error) => {
          if (
            this.peers.get(id) === peer &&
            error?.name === "NotAllowedError"
          ) {
            peer.blocked = true;
            this.updatePlayback();
          }
        });
    }
  };
  private updatePlayback() {
    useGame.setState({
      playbackBlocked: [...this.peers.values()].some((peer) => peer.blocked),
    });
  }
  private updateStatus() {
    if (!this.wanted || this.failed || !this.stream) return;
    const peers = [...this.peers.values()];
    const live = peers.some((peer) => peer.pc.connectionState === "connected");
    const waiting = peers.some(
      (peer) => !peer.failed && peer.pc.connectionState !== "connected",
    );
    useGame.setState({
      voiceStatus:
        live || !this.allowed.size
          ? "live"
          : waiting || !peers.length
            ? "connecting"
            : "error",
    });
  }
  private watch(id: string, stream: MediaStream) {
    if (!this.context) return;
    this.unwatch(id);
    const source = this.context.createMediaStreamSource(stream);
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    this.watches.set(id, {
      source,
      analyser,
      buffer: new Float32Array(analyser.fftSize),
    });
  }
  private unwatch(id: string) {
    const watch = this.watches.get(id);
    watch?.source.disconnect();
    watch?.analyser.disconnect();
    this.watches.delete(id);
  }
  private level(id: string) {
    const watch = this.watches.get(id);
    if (!watch) return 0;
    watch.analyser.getFloatTimeDomainData(watch.buffer);
    return Math.sqrt(
      watch.buffer.reduce((sum, value) => sum + value * value, 0) /
        watch.buffer.length,
    );
  }

  async getDiagnostics() {
    const peers = await Promise.all(
      [...this.peers].map(async ([id, peer]) => {
        const stats =
          peer.pc.connectionState === "closed"
            ? []
            : [...(await peer.pc.getStats()).values()];
        return {
          id,
          connectionState: peer.pc.connectionState,
          iceConnectionState: peer.pc.iceConnectionState,
          generation: peer.generation,
          paused: peer.audio.paused,
          level:
            peer.audio.paused || peer.audio.muted
              ? 0
              : this.level(id) * peer.audio.volume,
          inbound: stats
            .filter(
              (report) =>
                report.type === "inbound-rtp" && report.kind === "audio",
            )
            .map((report) => ({
              bytes: report.bytesReceived,
              packets: report.packetsReceived,
            })),
        };
      }),
    );
    return {
      generation: this.generation,
      transport: "webrtc",
      topology: "peer-to-peer",
      connectionState: peers.some(
        (peer) => peer.connectionState === "connected",
      )
        ? "connected"
        : peers.length
          ? "connecting"
          : "closed",
      microphoneEnabled:
        this.stream
          ?.getAudioTracks()
          .some((track) => track.readyState === "live" && track.enabled) ??
        false,
      contextState: this.context?.state ?? "closed",
      playbackPaused: peers.every((peer) => peer.paused),
      localLevel: this.level("local"),
      receivedLevel: Math.sqrt(
        peers.reduce((sum, peer) => sum + peer.level ** 2, 0),
      ),
      inbound: peers.flatMap((peer) => peer.inbound),
      peers,
    };
  }

  fail(message: string, generation = this.generation) {
    if (generation !== this.generation) return;
    this.failed = true;
    for (const id of [...this.peers.keys()]) this.closePeer(id);
    useGame.setState({
      voiceStatus: "error",
      voiceError: message,
      muted: true,
      ptt: false,
    });
    this.apply();
  }
  private peerError(id: string, peer: Peer, error: unknown) {
    peer.failed = true;
    this.releasePeer(id, peer);
    useGame.setState({ voiceError: this.describe(error) });
    this.updateStatus();
  }
  private releasePeer(id: string, peer: Peer) {
    clearTimeout(peer.retry);
    clearTimeout(peer.timeout);
    peer.pc.onicecandidate =
      peer.pc.onconnectionstatechange =
      peer.pc.ontrack =
        null;
    peer.pc.close();
    peer.source.disconnect();
    peer.gate.disconnect();
    peer.destination.disconnect();
    peer.destination.stream.getTracks().forEach((track) => track.stop());
    peer.audio.pause();
    peer.audio.srcObject = null;
    this.unwatch(id);
    peer.blocked = false;
    this.updatePlayback();
  }
  private closePeer(id: string) {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    this.releasePeer(id, peer);
  }
  disconnect() {
    this.generation++;
    for (const id of [...this.peers.keys()]) this.closePeer(id);
    this.allowed.clear();
    this.pending.clear();
    this.latest.clear();
    this.early.clear();
    this.stream?.getTracks().forEach((track) => {
      track.enabled = false;
    });
    useGame.setState({
      voiceStatus: this.wanted ? "reconnecting" : "off",
      ptt: false,
      playbackBlocked: false,
    });
  }
  dispose() {
    this.wanted = false;
    clearInterval(this.meter);
    this.meter = undefined;
    this.disconnect();
    this.enabling = null;
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    this.stream = null;
    this.unwatch("local");
    void this.context?.close();
    this.context = null;
    useGame.setState({
      muted: true,
      deafened: false,
      voiceStatus: "off",
      voiceError: "",
      playbackBlocked: false,
    });
  }
  private describe(error: unknown) {
    if (
      error instanceof DOMException &&
      ["NotAllowedError", "SecurityError"].includes(error.name)
    )
      return "Allow microphone access in your browser, then tap the microphone to retry.";
    return error instanceof Error
      ? error.message
      : "Voice setup failed. Tap the microphone to retry.";
  }
}
export const voice = new VoiceChat();
