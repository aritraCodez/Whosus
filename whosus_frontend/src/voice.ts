import { useGame } from "./store";
import { send } from "./network";

type Watch = {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  buffer: Float32Array;
};

/** Browser media lifecycle adapted for one trusted server audio connection. */
export class VoiceChat {
  private pc: RTCPeerConnection | null = null;
  private stream: MediaStream | null = null;
  private audio: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  private watches = new Map<string, Watch>();
  private ice: RTCIceServer[] = [];
  private generation = 0;
  private wanted = false;
  private enabling: Promise<boolean> | null = null;
  private negotiating: Promise<void> | null = null;
  private signals: Promise<void> = Promise.resolve();
  private retry: ReturnType<typeof setTimeout> | undefined;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private detach: (() => void) | null = null;

  configure(servers: RTCIceServer[]) {
    // An explicitly empty list enables local-only ICE without external STUN.
    this.ice = servers;
  }

  attach() {
    if (this.detach) return this.detach;
    const stop = () => this.ptt(false);
    window.addEventListener("pointerdown", this.resume);
    window.addEventListener("keydown", this.resume);
    window.addEventListener("blur", stop);
    const hidden = () => {
      if (document.hidden) stop();
    };
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
    // Unlock playback in the user gesture, before awaiting microphone access.
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
    const task = this.enableMic(openMic);
    this.enabling = task;
    void task.finally(() => {
      if (this.enabling === task) this.enabling = null;
    });
    return task;
  }

  private async enableMic(openMic: boolean): Promise<boolean> {
    const generation = this.generation;
    useGame.setState({ voiceError: "" });
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access needs HTTPS or localhost.");
      }
      if (
        !this.stream
          ?.getAudioTracks()
          .some((track) => track.readyState === "live")
      ) {
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;
        useGame.setState({ voiceStatus: "connecting" });
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
      this.apply();
      if (!this.pc || ["closed", "failed"].includes(this.pc.connectionState)) {
        await this.negotiate();
      } else {
        // Reuse the negotiated audio transceiver, as in the supplied implementation.
        const channel = this.pc
          .getTransceivers()
          .find((item) => item.receiver.track.kind === "audio");
        if (channel)
          await channel.sender.replaceTrack(this.stream.getAudioTracks()[0]);
      }
      this.resume();
      return true;
    } catch (error) {
      // Old permission or negotiation failures must not tear down a newer session.
      if (generation === this.generation) this.fail(this.describe(error));
      return false;
    }
  }

  private negotiate(): Promise<void> {
    if (this.negotiating) return this.negotiating;
    const task = this.offer();
    this.negotiating = task;
    void task
      .finally(() => {
        if (this.negotiating === task) this.negotiating = null;
      })
      .catch(() => {});
    return task;
  }

  private async offer() {
    if (!this.stream || typeof RTCPeerConnection !== "function") {
      throw new Error(
        "Voice chat needs a browser with WebRTC and a live microphone.",
      );
    }
    this.closeTransport();
    const generation = this.generation;
    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({ iceServers: this.ice });
    } catch (error) {
      this.fail(this.describe(error), generation);
      throw error;
    }
    this.pc = pc;
    useGame.setState({ voiceStatus: "connecting", voiceError: "" });
    pc.addTransceiver(this.stream.getAudioTracks()[0], {
      direction: "sendrecv",
    });
    let sentOffer = false;
    const pendingIce: (RTCIceCandidateInit | null)[] = [];
    const current = () => this.pc === pc && this.generation === generation;

    pc.onicecandidate = (event) => {
      if (!current()) return;
      const candidate = event.candidate?.toJSON() ?? null;
      if (!sentOffer) pendingIce.push(candidate);
      else send({ type: "voice_ice", candidate, generation });
    };
    pc.ontrack = (event) => {
      if (!current()) return;
      const media = event.streams[0] ?? new MediaStream([event.track]);
      this.ensureAudio().srcObject = media;
      this.watch("remote", media);
      event.track.onunmute = () => {
        if (current()) this.resume();
      };
      this.resume();
    };
    pc.onconnectionstatechange = () => {
      if (!current()) return;
      if (pc.connectionState === "connected") {
        clearTimeout(this.retry);
        clearTimeout(this.timeout);
        useGame.setState({ voiceStatus: "live", voiceError: "" });
        this.apply();
        this.resume();
      } else if (["disconnected", "failed"].includes(pc.connectionState)) {
        useGame.setState({ voiceStatus: "reconnecting" });
        clearTimeout(this.retry);
        this.retry = setTimeout(() => {
          if (current() && pc.connectionState !== "connected")
            void this.reconnect();
        }, 4000);
      }
    };

    try {
      await pc.setLocalDescription(await pc.createOffer());
      if (!current()) return;
      // Do not wait for STUN/TURN gathering. Send the SDP now and trickle ICE.
      if (
        !send({
          type: "voice_offer",
          sdp: pc.localDescription!.sdp,
          generation,
        })
      ) {
        throw new Error(
          "The room connection was lost. Reconnect before enabling voice.",
        );
      }
      sentOffer = true;
      for (const candidate of pendingIce)
        send({ type: "voice_ice", candidate, generation });
      pendingIce.length = 0;
      this.timeout = setTimeout(() => {
        if (current() && pc.connectionState !== "connected") {
          this.fail(
            "Voice could not connect. Check your network or TURN relay, then retry.",
            generation,
          );
        }
      }, 25000);
    } catch (error) {
      if (current()) this.fail(this.describe(error), generation);
      throw error;
    }
  }

  answer(sdp: string, generation: number) {
    const pc = this.pc;
    this.signals = this.signals
      .then(async () => {
        if (!pc || this.pc !== pc || generation !== this.generation) return;
        await pc.setRemoteDescription({ type: "answer", sdp });
      })
      .catch(() =>
        this.fail(
          "Could not establish audio. Tap the microphone to retry.",
          generation,
        ),
      );
    return this.signals;
  }

  async reconnect() {
    if (
      !this.wanted ||
      !this.stream ||
      useGame.getState().status !== "connected"
    )
      return;
    try {
      await this.negotiate();
      this.apply();
    } catch {
      /* The current offer reports its own error; stale offers are discarded. */
    }
  }

  mute() {
    this.setMuted(!useGame.getState().muted);
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
    if (held && (!this.stream || useGame.getState().voiceStatus === "error")) {
      void this.enable(false);
    } else this.apply();
  }

  deafen() {
    this.setDeafened(!useGame.getState().deafened);
  }
  setDeafened(deafened: boolean) {
    useGame.setState({ deafened });
    if (this.audio) this.audio.muted = deafened;
    this.apply();
    if (!deafened) this.resume();
  }

  private apply() {
    const state = useGame.getState();
    const muted = (state.muted && !state.ptt) || state.deafened || !this.stream;
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    send({ type: "voice_state", muted, deafened: state.deafened });
  }

  private ensureAudio() {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.autoplay = true;
      this.audio.setAttribute("playsinline", "");
    }
    this.audio.muted = useGame.getState().deafened;
    return this.audio;
  }

  private unlock() {
    if (typeof AudioContext === "function" && !this.context)
      this.context = new AudioContext();
    this.ensureAudio();
    this.resume();
  }

  resume = () => {
    if (this.context?.state === "suspended")
      void this.context.resume().catch(() => {});
    const audio = this.audio;
    if (
      !audio?.srcObject ||
      (!audio.paused && !useGame.getState().playbackBlocked)
    )
      return;
    void audio
      .play()
      .then(() => {
        if (this.audio === audio) useGame.setState({ playbackBlocked: false });
      })
      .catch((error) => {
        // A replaced/stopped stream raises AbortError, not an autoplay denial.
        if (this.audio === audio && error?.name === "NotAllowedError") {
          useGame.setState({ playbackBlocked: true });
        }
      });
  };

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

  /** Media evidence without exposing SDP, session tokens or network addresses. */
  async getDiagnostics() {
    const pc = this.pc;
    const reports = pc ? [...(await pc.getStats()).values()] : [];
    return {
      generation: this.generation,
      connectionState: pc?.connectionState ?? "closed",
      iceConnectionState: pc?.iceConnectionState ?? "closed",
      iceGatheringState: pc?.iceGatheringState ?? "complete",
      microphoneEnabled:
        this.stream
          ?.getAudioTracks()
          .some((track) => track.readyState === "live" && track.enabled) ??
        false,
      contextState: this.context?.state ?? "closed",
      playbackPaused: this.audio?.paused ?? true,
      localLevel: this.level("local"),
      receivedLevel: useGame.getState().deafened ? 0 : this.level("remote"),
      inbound: reports
        .filter(
          (report) => report.type === "inbound-rtp" && report.kind === "audio",
        )
        .map((report) => ({
          bytes: report.bytesReceived,
          packets: report.packetsReceived,
        })),
    };
  }

  fail(message: string, generation = this.generation) {
    if (generation !== this.generation) return;
    send({ type: "voice_stop", generation });
    this.closeTransport();
    useGame.setState({
      voiceStatus: "error",
      voiceError: message,
      muted: true,
      ptt: false,
    });
    this.stream?.getTracks().forEach((track) => {
      track.enabled = false;
    });
    this.apply();
  }

  private closeTransport() {
    this.generation++;
    clearTimeout(this.retry);
    clearTimeout(this.timeout);
    const pc = this.pc;
    this.pc = null;
    if (pc) {
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.ontrack = null;
      pc.close();
    }
    this.signals = Promise.resolve();
    this.unwatch("remote");
    if (this.audio) {
      this.audio.pause();
      this.audio.srcObject = null;
    }
    useGame.setState({ playbackBlocked: false });
  }

  disconnect() {
    this.closeTransport();
    this.negotiating = null;
    this.stream?.getTracks().forEach((track) => {
      track.enabled = false;
    });
    useGame.setState({
      voiceStatus: this.wanted ? "reconnecting" : "off",
      ptt: false,
    });
  }

  dispose() {
    this.wanted = false;
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
    this.audio = null;
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
    ) {
      return "Allow microphone access in your browser, then tap the microphone to retry.";
    }
    return error instanceof Error
      ? error.message
      : "Voice setup failed. Tap the microphone to retry.";
  }
}

export const voice = new VoiceChat();
