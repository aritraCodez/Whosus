import { backendWebSocketUrl } from "@/config/backend";
import { sound } from "@/features/game/audio/sounds";
import { useGame } from "@/features/game/model/game-store";
import { motion,movementInput } from "@/features/game/model/motion";
import type { Snapshot } from "@/features/game/model/types";
import { move } from "@/features/game/model/world";
import { closeTestPlayers } from "@/features/lobby/model/test-players";
import { voice } from "@/features/voice/voice-client";
import { send,setGameSocket } from "@/services/game-socket";
export { motion,movementInput,renderPosition } from "@/features/game/model/motion";
export { send } from "@/services/game-socket";
let ws: WebSocket | null = null,
  retry: ReturnType<typeof setTimeout> | undefined,
  stopped = true;
let token = sessionStorage.getItem("whosus-session") || "";
let queued: Record<string, unknown> | null = null,
  lastRound = -1,
  lastPhase = "",
  lastPong = 0;
export const act = (
  action: string,
  target = "",
  value?: string | number | boolean,
) => {
  sound();
  send({
    type: "action",
    action,
    target,
    ...(value === undefined ? {} : { value }),
  });
};
export function connect(message?: Record<string, unknown>) {
  if (message) {
    queued = message;
    token = "";
    sessionStorage.removeItem("whosus-session");
  }
  stopped = false;
  clearTimeout(retry);
  if (ws) {
    ws.onclose = null;
    ws.close();
  }
  useGame.setState({ status: "connecting", error: "" });
  const socket = new WebSocket(backendWebSocketUrl());
  ws = socket;
  setGameSocket(socket);
  socket.onopen = () => {
    lastPong = Date.now();
    useGame.setState({ status: "connected" });
    if (token) send({ type: "resume", token });
    else if (queued) {
      send(queued);
      queued = null;
    }
  };
  socket.onmessage = (event) => {
    const m = JSON.parse(event.data);
    if (m.type === "joined") {
      token = m.token;
      sessionStorage.setItem("whosus-session", token);
      useGame.setState({ id: m.id, error: "" });
      voice.configure(m.iceServers);
      motion.pending = [];
      lastRound = -1;
      motion.keys.clear();
      motion.dx = motion.dz = 0;
      void voice.reconnect();
    }
    if (m.type === "snapshot") {
      const r = m.room as Snapshot,
        me = r.players.find((p) => p.id === useGame.getState().id);
      if (me) {
        const previousMe = useGame.getState().room?.players.find(p => p.id === me.id);
        if (me.seat !== previousMe?.seat) motion.pending = [];
        if (r.vent !== useGame.getState().room?.vent) {
          motion.pending = [];
          motion.revision++;
        }
        if (r.movementSpeed !== useGame.getState().room?.movementSpeed) {
          motion.pending = [];
          motion.revision++;
        }
        if (r.round !== lastRound || r.phase !== lastPhase) {
          motion.pending = [];
          motion.revision++;
          useGame.setState({ map: false });
          if (r.phase !== lastPhase) useGame.setState({ fakeChallenge: null, practiceOpen: false });
          if (r.round !== lastRound) useGame.setState({ fakeDone: {} });
          lastRound = r.round;
          if (r.phase === "discussion") sound("meeting");
          if (r.phase === "gameover") sound("task");
        }
        motion.seq = Math.max(motion.seq, me.ack);
        motion.pending = motion.pending.filter((i) => i.seq > me.ack);
        if (r.movementLock > 0 || r.vent >= 0 || (me.seat ?? -1) >= 0) motion.pending = [];
        let [x, z] = [me.x, me.z];
        if (["playing", "lobby"].includes(r.phase) && r.vent < 0)
          for (const i of motion.pending)
            [x, z] = move(x, z, i.dx, i.dz, !me.alive, r.phase === "lobby", r.movementSpeed ?? 1);
        motion.x = x;
        motion.z = z;
      }
      lastPhase = r.phase;
      useGame.setState({ room: r, speaking: m.speaking });
      voice.sync(m.voicePeers ?? []);
    }
    if (m.type === "chat") {
      const s = useGame.getState();
      useGame.setState({ chat: [...s.chat.slice(-99), m.message] });
      if (!s.chatOpen) sound();
    }
    if (m.type === "voice_signal") void voice.signal(m);
    if (m.type === "error") useGame.setState({ error: m.message });
    if (m.type === "kicked") {
      leave();
      useGame.setState({ error: m.message });
      return;
    }
    if (m.type === "expired") {
      token = "";
      sessionStorage.removeItem("whosus-session");
      useGame.setState({ room: null, error: m.message });
    }
    if (m.type === "pong") lastPong = Date.now();
  };
  socket.onclose = (event) => {
    voice.disconnect();
    if (ws !== socket) return;
    useGame.setState({ status: "offline" });
    if (event.code === 4001) {
      stopped = true;
      useGame.setState({ error: "This session was opened in another tab." });
    }
    if (!stopped && token) retry = setTimeout(() => connect(), 2000);
    else if (!stopped)
      useGame.setState({
        error:
          "Cannot reach the game server. Start the FastAPI backend and try again.",
      });
  };
  socket.onerror = () =>
    useGame.setState({
      error: "Connection unavailable. Check the game server.",
    });
}
export function leave() {
  stopped = true;
  closeTestPlayers();
  send({ type: "leave" });
  token = "";
  sessionStorage.removeItem("whosus-session");
  voice.dispose();
  ws?.close();
  ws = null;
  setGameSocket(null);
  clearTimeout(retry);
  motion.pending = [];
  motion.keys.clear();
  motion.dx = motion.dz = 0;
  useGame.setState({
    room: null,
    id: "",
    chat: [],
    error: "",
    status: "offline",
    fakeChallenge: null,
    fakeDone: {},
    practiceOpen: false,
    wardrobe: false,
    settings: false,
  });
}
export function initializeNetwork() {
  const detachVoice = voice.attach();
  if (token) connect();
  const step = () => {
    const s = useGame.getState(),
      r = s.room;
    if (
      !r ||
      s.status !== "connected" ||
      !["playing", "lobby"].includes(r.phase) ||
      r.vent >= 0
    )
      return;
    const [dx, dz] = movementInput();
    if (!dx && !dz) return;
    // Keep prediction history responsive without freezing movement during latency spikes.
    if (motion.pending.length >= 50) {
      motion.pending = motion.pending.slice(-25);
    }
    const i = {
      seq: ++motion.seq,
      dx: Math.max(-1, Math.min(1, dx)),
      dz: Math.max(-1, Math.min(1, dz)),
    };
    send({ type: "input", round: r.round, ...i });
    motion.pending.push(i);
    const me = r.players.find((p) => p.id === s.id);
    [motion.x, motion.z] = move(
      motion.x,
      motion.z,
      i.dx,
      i.dz,
      me ? !me.alive : false,
      r.phase === "lobby",
      r.movementSpeed ?? 1,
    );
  };
  // Browsers can defer interval timers while native keyboard repeat is active.
  // Keep the 20 Hz input cadence on the animation clock so held keys keep moving.
  let frame = 0;
  let steppedAt = performance.now();
  let nextPing = steppedAt + 5000;
  const heartbeat = () => {
    const now = performance.now();
    if (now < nextPing) return;
    nextPing = now + 5000;
    if (ws?.readyState === WebSocket.OPEN) {
      if (Date.now() - lastPong > 20000) ws.close();
      else send({ type: "ping" });
    }
  };
  const resetClock = () => {
    steppedAt = motion.steppedAt = performance.now();
  };
  const update = (now: number) => {
    const elapsed = now - steppedAt;
    if (elapsed >= 50) {
      // Catch up short frame delays without replaying time spent in a hidden tab.
      const steps = elapsed > 250 ? 1 : Math.floor(elapsed / 50);
      steppedAt = elapsed > 250 ? now : steppedAt + steps * 50;
      for (let i = 0; i < steps; i++) step();
      motion.steppedAt = steppedAt;
    }
    heartbeat();
    frame = requestAnimationFrame(update);
  };
  frame = requestAnimationFrame(update);
  window.addEventListener("focus", resetClock);
  document.addEventListener("visibilitychange", resetClock);
  // Retain a timer fallback for heartbeats while a hidden tab pauses rendering.
  const ping = setInterval(heartbeat, 5000);
  return () => {
    detachVoice();
    cancelAnimationFrame(frame);
    window.removeEventListener("focus", resetClock);
    document.removeEventListener("visibilitychange", resetClock);
    clearInterval(ping);
    leave();
  };
}
