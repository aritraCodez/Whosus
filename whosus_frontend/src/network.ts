import { useGame } from "./store";
import { move } from "./world";
import { voice } from "./voice";
import { sound } from "./audio";
import { backendWebSocketUrl } from "./backend";
import { closeTestPlayers } from "./devPlayers";
import type { Snapshot } from "./types";
type Input = { seq: number; dx: number; dz: number };
export const motion = {
  x: 0,
  z: 2,
  dx: 0,
  dz: 0,
  keys: new Set<string>(),
  pending: [] as Input[],
  seq: 0,
  steppedAt: 0,
  renderX: 0,
  renderZ: 2,
  revision: 0,
};
// Controls are relative to the screen, matching the isometric camera.
export function movementInput(): [number, number] {
  const s = useGame.getState(),
    r = s.room;
  if (
    !r ||
    s.status !== "connected" ||
    !["playing", "lobby"].includes(r.phase) ||
    r.vent >= 0 ||
    r.movementLock > 0 ||
    s.settings ||
    r.challenge ||
    document.querySelector("dialog[open]") ||
    document.activeElement?.matches(
      "input,textarea,select,[contenteditable=true]",
    )
  )
    return [0, 0];
  const held = (a: string, b: string) =>
    motion.keys.has(a) || motion.keys.has(b) ? 1 : 0;
  let x = motion.dx + held("KeyD", "ArrowRight") - held("KeyA", "ArrowLeft"),
    z = motion.dz + held("KeyS", "ArrowDown") - held("KeyW", "ArrowUp");
  const n = Math.max(1, Math.hypot(x, z));
  x /= n;
  z /= n;
  const length = Math.hypot(18, 13);
  return [(18 * x + 13 * z) / length, (-13 * x + 18 * z) / length];
}
export function renderPosition() {
  const r = useGame.getState().room;
  const [dx, dz] = movementInput();
  const me = r?.players.find((p) => p.id === useGame.getState().id);
  const fraction =
    motion.pending.length >= 6
      ? 0
      : Math.min(1, (performance.now() - motion.steppedAt) / 50);
  return move(
    motion.x,
    motion.z,
    dx,
    dz,
    me ? !me.alive : false,
    r?.phase === "lobby",
    fraction,
  );
}
let ws: WebSocket | null = null,
  retry: ReturnType<typeof setTimeout> | undefined,
  stopped = true;
let token = sessionStorage.getItem("whosus-session") || "";
let queued: Record<string, unknown> | null = null,
  lastRound = -1,
  lastPhase = "",
  lastPong = 0;
export const send = (data: Record<string, unknown>) => {
  if (ws?.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(data));
  return true;
};
export const act = (action: string, target = "", value?: number) => {
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
        if (r.round !== lastRound || r.phase !== lastPhase) {
          motion.pending = [];
          motion.revision++;
          useGame.setState({ map: false });
          lastRound = r.round;
          if (r.phase === "discussion") sound("meeting");
          if (r.phase === "gameover") sound("task");
        }
        motion.seq = Math.max(motion.seq, me.ack);
        motion.pending = motion.pending.filter((i) => i.seq > me.ack);
        if (r.movementLock > 0) motion.pending = [];
        let [x, z] = [me.x, me.z];
        if (["playing", "lobby"].includes(r.phase) && r.vent < 0)
          for (const i of motion.pending)
            [x, z] = move(x, z, i.dx, i.dz, !me.alive, r.phase === "lobby");
        motion.x = x;
        motion.z = z;
      }
      lastPhase = r.phase;
      useGame.setState({ room: r, speaking: m.speaking });
    }
    if (m.type === "chat") {
      const s = useGame.getState();
      useGame.setState({ chat: [...s.chat.slice(-99), m.message] });
      if (!s.chatOpen) sound();
    }
    if (m.type === "voice_answer") void voice.answer(m.sdp, m.generation);
    if (m.type === "voice_error") voice.fail(m.message, m.generation);
    if (m.type === "error") useGame.setState({ error: m.message });
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
  });
}
export function initializeNetwork() {
  const detachVoice = voice.attach();
  if (token) connect();
  const timer = setInterval(() => {
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
    motion.steppedAt = performance.now();
    if (!dx && !dz) return;
    if (motion.pending.length >= 6) return;
    const i = {
      seq: ++motion.seq,
      dx: Math.max(-1, Math.min(1, dx)),
      dz: Math.max(-1, Math.min(1, dz)),
    };
    if (!send({ type: "input", round: r.round, ...i })) return;
    motion.pending.push(i);
    const me = r.players.find((p) => p.id === s.id);
    [motion.x, motion.z] = move(
      motion.x,
      motion.z,
      i.dx,
      i.dz,
      me ? !me.alive : false,
      r.phase === "lobby",
    );
  }, 50);
  const ping = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      if (Date.now() - lastPong > 20000) ws.close();
      else send({ type: "ping" });
    }
  }, 5000);
  return () => {
    detachVoice();
    clearInterval(timer);
    clearInterval(ping);
    leave();
  };
}
