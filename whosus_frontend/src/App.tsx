import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  DoorOpen,
  Headphones,
  HelpCircle,
  Leaf,
  Map,
  MessageCircle,
  Mic,
  MicOff,
  Plus,
  Pencil,
  Radio,
  Settings,
  Shield,
  Skull,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import Scene from "./Scene";
import { Modal } from "./components/Modal";
import { PracticePanel, UniversalTaskPanel } from "./TaskMinigames";
import { useGame } from "./store";
import {
  act,
  connect,
  initializeNetwork,
  leave,
  motion,
  send,
} from "./network";
import { voice } from "./voice";
import { COLORS, type Player } from "./types";
import { STATIONS } from "./world";
import { sound } from "./audio";
import { backendApiUrl } from "./backend";
import { fillLobbyWithTestPlayers } from "./devPlayers";
import { NumberRule, RoomRules } from "./RoomRules";
import { interactWithStation, openPractice } from "./interactions";
import { ELIMINATION_NAMES } from "./EliminationEffect";

function BotIcon({
  color = "#f6bd4f",
  small = false,
}: {
  color?: string;
  small?: boolean;
}) {
  return (
    <div
      className={`bot-icon ${small ? "small" : ""}`}
      style={{ "--bot": color } as React.CSSProperties}
    >
      <i />
      <span>
        <b />
        <b />
      </span>
      <em />
    </div>
  );
}
function interact() { interactWithStation(); }
function report() {
  const r = useGame.getState().room;
  const b = r?.bodies.find(
    (b) => Math.hypot(b.x - motion.x, b.z - motion.z) <= 2.5,
  );
  if (b) act("report", b.id);
  else
    useGame.setState({ error: "No fallen explorer within reporting range." });
}
function eliminate() {
  const s = useGame.getState();
  if (
    s.room?.phase !== "playing" ||
    s.room.killCooldown > 0 ||
    s.room.movementLock > 0
  )
    return;
  const me = s.room.players.find((p) => p.id === s.id);
  if (!me?.alive || me.role !== "impostor" || s.room.vent >= 0) return;
  const q = s.room?.players
    .filter(
      (p) =>
        p.id !== s.id &&
        p.alive &&
        p.role !== "impostor" &&
        Math.hypot(p.x - motion.x, p.z - motion.z) <= 1.8,
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - motion.x, a.z - motion.z) -
        Math.hypot(b.x - motion.x, b.z - motion.z),
    )[0];
  if (q) act("kill", q.id, -1);
}

function HoldButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className: string;
}) {
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const action = useRef(onClick);
  action.current = onClick;
  const stop = () => {
    clearInterval(timer.current);
    timer.current = undefined;
  };
  useEffect(() => {
    if (disabled) stop();
    return stop;
  }, [disabled]);
  useEffect(() => {
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      stop();
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, []);
  return (
    <button
      className={className}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        stop();
        action.current();
        timer.current = setInterval(() => action.current(), 250);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onClick={(e) => {
        if (e.detail === 0) action.current();
      }}
    >
      {children}
    </button>
  );
}

function makeDefaultName() {
  return `Explorer-${Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, "0")
    .toUpperCase()}`;
}

function RoomForm({
  mode,
  name,
  setName,
  color,
  hat,
  close,
}: {
  mode: "create" | "join" | "find";
  name: string;
  setName: (name: string) => void;
  color: number;
  hat: string;
  close: () => void;
}) {
  const [code, setCode] = useState(""),
    [capacity, setCapacity] = useState(8),
    [publicRoom, setPublic] = useState(false),
    [impostors, setImpostors] = useState(1),
    [cooldown, setCooldown] = useState(25),
    [discussion, setDiscussion] = useState(25),
    [speed, setSpeed] = useState(1),
    [voting, setVoting] = useState(30),
    [meetings, setMeetings] = useState(1),
    [meetingCooldown, setMeetingCooldown] = useState(20);
  const [list, setList] = useState<
      { code: string; players: number; capacity: number; host: string }[]
    >([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch(backendApiUrl("/api/rooms"));
      if (!res.ok) throw Error();
      setList(await res.json());
      setError("");
    } catch {
      setError(
        "The game server is unavailable. Start the backend to find rooms.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (mode === "find") void refresh();
  }, [mode]);
  function join(roomCode: string) {
    const playerName = name.trim();
    if (!playerName) {
      setError("Enter an explorer name before joining.");
      return;
    }
    connect({ type: "join", name: playerName, color, hat, code: roomCode });
    close();
  }
  const nameField = (
    <label>
      YOUR EXPLORER
      <input
        aria-label="Explorer name"
        autoComplete="nickname"
        maxLength={18}
        required
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError("");
        }}
      />
    </label>
  );
  return (
    <Modal
      title={
        mode === "create"
          ? "Gather your suspects."
          : mode === "join"
            ? "You’re on the list."
            : "Find your next crew."
      }
      close={close}
    >
      <p className="muted">
        {mode === "create"
          ? "A new expedition. A few friends. What could go wrong?"
          : mode === "join"
            ? "Enter the six-character code your host shared."
            : "Open expeditions waiting for a little company."}
      </p>
      {mode === "create" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const playerName = name.trim();
            if (!playerName) {
              setError("Enter an explorer name before creating a room.");
              return;
            }
            connect({
              type: "create",
              name: playerName,
              color,
              hat,
              capacity,
              public: publicRoom,
              impostors,
              kill_cooldown: cooldown,
              discussion,
              movement_speed: speed,
              voting,
              emergency_meetings: meetings,
              meeting_cooldown: meetingCooldown,
            });
            close();
          }}
        >
          {nameField}
          {error && <p className="error-text">{error}</p>}
          <div className="map-card">
            <div className="map-symbol">
              <Leaf />
            </div>
            <div>
              <small>YOUR DESTINATION</small>
              <h3>Cloudline Station</h3>
              <p>9 rooms · interactive tasks · many alibis</p>
            </div>
            <span className="tag">ORIGINAL</span>
          </div>
          <div className="form-grid">
            <NumberRule label="Movement speed" value={speed} options={[.5,.75,1,1.25,1.5,1.75,2]} suffix="×" onChange={setSpeed} />
            <NumberRule label="Voting time" value={voting} options={[10,15,30,45,60,90,120]} suffix=" s" onChange={setVoting} />
            <NumberRule label="Emergency meetings per player" value={meetings} options={[0,1,2,3]} onChange={setMeetings} />
            <NumberRule label="Meeting cooldown" value={meetingCooldown} options={[10,15,20,25,30,45,60]} suffix=" s" onChange={setMeetingCooldown} />
            <label>
              Crew capacity
              <select
                value={capacity}
                onChange={(e) => setCapacity(+e.target.value)}
              >
                {Array.from({ length: 9 }, (_, i) => (
                  <option key={i} value={i + 4}>
                    {i + 4} players
                  </option>
                ))}
              </select>
            </label>
            <label>
              Impostors
              <select
                value={impostors}
                onChange={(e) => setImpostors(+e.target.value)}
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "impostor" : "impostors"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Elimination cooldown
              <select
                value={cooldown}
                onChange={(e) => setCooldown(+e.target.value)}
              >
                {[10, 20, 25, 30, 45, 60].map((n) => (
                  <option key={n} value={n}>
                    {n} seconds
                  </option>
                ))}
              </select>
            </label>
            <label>
              Discussion time
              <select
                value={discussion}
                onChange={(e) => setDiscussion(+e.target.value)}
              >
                {[10, 25, 45, 60, 90].map((n) => (
                  <option key={n} value={n}>
                    {n} seconds
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="hint">
            Impostors are capped at one per three other players to keep the
            match fair.
          </p>
          <label className="toggle-line">
            <span>
              <strong>Public expedition</strong>
              <small>Let other explorers discover your room</small>
            </span>
            <input
              type="checkbox"
              checked={publicRoom}
              onChange={(e) => setPublic(e.target.checked)}
            />
          </label>
          <button className="primary full" type="submit">
            Create room <ArrowRight size={18} />
          </button>
        </form>
      ) : mode === "join" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            join(code);
          }}
        >
          {nameField}
          {error && <p className="error-text">{error}</p>}
          <label>
            ROOM CODE
            <input
              className="code-input"
              autoFocus
              maxLength={6}
              minLength={6}
              required
              pattern="[A-Za-z2-9]{6}"
              placeholder="ABCDEF"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))
              }
            />
          </label>
          <button className="primary full" type="submit">
            Join expedition <ArrowRight size={18} />
          </button>
        </form>
      ) : (
        <div>
          {nameField}
          {error && <p className="error-text">{error}</p>}
          {loading ? (
            <p>Looking for expeditions…</p>
          ) : error ? (
            <p className="error-text">{error}</p>
          ) : list.length ? (
            list.map((r) => (
              <button
                className="room-row"
                key={r.code}
                onClick={() => join(r.code)}
              >
                <span>
                  <strong>{r.host}’s expedition</strong>
                  <small>{r.code} · Cloudline Station</small>
                </span>
                <span>
                  {r.players}/{r.capacity} <ArrowRight size={16} />
                </span>
              </button>
            ))
          ) : (
            <div className="empty">
              <Radio />
              <h3>A quiet sky, for now.</h3>
              <p>Create a public room and invite your first crew.</p>
            </div>
          )}
          <button className="secondary full" onClick={refresh}>
            Refresh expeditions
          </button>
        </div>
      )}
    </Modal>
  );
}

function Menu({
  name,
  setName,
  color,
  setColor,
  hat,
  setHat,
}: {
  name: string;
  setName: (n: string) => void;
  color: number;
  setColor: (n: number) => void;
  hat: string;
  setHat: (s: string) => void;
}) {
  const [form, setForm] = useState<"create" | "join" | "find" | null>(null),
    [help, setHelp] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const editName = () => {
    nameInput.current?.focus();
    nameInput.current?.select();
  };
  return (
    <div className="menu">
      <header className="masthead">
        <a className="wordmark" href="#" aria-label="WhoSus home">
          <span className="mark-eyes">••</span> who<span>sus?</span>
        </a>
        <nav>
          <span className="nav-active">PLAY</span>
          <button onClick={() => setHelp(true)}>
            FIELD GUIDE <HelpCircle size={14} />
          </button>
        </nav>
        <button
          className="icon"
          aria-label="Settings"
          onClick={() => useGame.setState({ settings: true })}
        >
          <Settings size={20} />
        </button>
      </header>
      <main className="menu-main">
        <section className="intro">
          <div className="eyebrow">
            <span /> A SMALL CREW. A BIG LITTLE MYSTERY.
          </div>
          <h1>
            Good friends.
            <br />
            Bad <span>alibis.</span>
            <svg viewBox="0 0 260 20" aria-hidden="true">
              <path d="M4 13 Q130 -2 254 10 M25 18 Q140 6 232 13" />
            </svg>
          </h1>
          <p className="lead">
            Keep the station running.
            <br />
            Keep an eye on your friends.
            <br />
            <strong>Someone’s not who they say they are.</strong>
          </p>
          <div
            className="player-custom"
            onClick={(e) => {
              if (!(e.target instanceof HTMLInputElement)) editName();
            }}
          >
            <BotIcon color={COLORS[color]} />
            <div>
              <label htmlFor="name">YOUR EXPLORER</label>
              <input
                ref={nameInput}
                id="name"
                aria-label="Explorer name"
                value={name}
                maxLength={18}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            </div>
            <button
              type="button"
              className="pencil"
              aria-label="Edit explorer name"
              onClick={editName}
            >
              <Pencil size={20} />
            </button>
          </div>
          <div className="custom-options">
            <div className="colors" aria-label="Character color">
              {COLORS.slice(0, 8).map((c, i) => (
                <button
                  key={c}
                  aria-label={`Color ${i + 1}`}
                  aria-pressed={color === i}
                  onClick={() => setColor(i)}
                  style={{ background: c }}
                >
                  {color === i && <Check size={14} />}
                </button>
              ))}
            </div>
            <select
              aria-label="Character accessory"
              value={hat}
              onChange={(e) => setHat(e.target.value)}
            >
              <option value="sprout">Little sprout</option>
              <option value="antenna">Antenna</option>
              <option value="none">No accessory</option>
            </select>
          </div>
          <button
            className="primary create"
            onClick={() => {
              sound();
              setForm("create");
            }}
          >
            <Plus size={21} />
            <span>Create a room</span>
            <ArrowRight size={20} />
          </button>
          <div className="join-actions">
            <button className="secondary" onClick={() => setForm("join")}>
              <Users size={17} /> Join with code
            </button>
            <button className="text-button" onClick={() => setForm("find")}>
              Find a crew <ChevronRight size={16} />
            </button>
          </div>
          <div className="play-notes">
            <span>
              <Users size={13} /> 4–12 players
            </span>
            <i />
            <span>
              <Mic size={13} /> Proximity voice
            </span>
            <i />
            <span>Free to play</span>
          </div>
        </section>
        <section className="scene-copy">
          <div className="station-tag">
            <span className="live-dot" /> NEXT STOP{" "}
            <span>01 / CLOUDLINE STATION</span>
          </div>
          <div className="floating-note">
            <span className="note-icon">
              <Radio size={19} />
            </span>
            <div>
              <strong>“I was in Botanical.”</strong>
              <small>Sure you were, Miso.</small>
            </div>
            <span className="note-dot" />
          </div>
          <div className="destination">
            <span className="tiny-label">SOMEWHERE ABOVE SUSPICION</span>
            <h2>
              Cloudline Station <ArrowDown size={20} />
            </h2>
            <p>
              A peaceful little outpost.
              <br />
              Until you arrive.
            </p>
          </div>
          <span className="coordinate">
            ALT. 08,420 M &nbsp; / &nbsp; ALL SYSTEMS NOMINAL
          </span>
        </section>
      </main>
      <footer className="menu-footer">
        <span>
          <span className="live-dot" /> ALL ABOARD, TRUST OPTIONAL.
        </span>
        <button onClick={() => setHelp(true)}>
          New around here?{" "}
          <strong>
            How to play <ArrowRight size={14} />
          </strong>
        </button>
        <span>
          WHOSUS? <b>VOL. 01</b>
        </span>
      </footer>
      {form && (
        <RoomForm
          mode={form}
          name={name}
          setName={setName}
          color={color}
          hat={hat}
          close={() => setForm(null)}
        />
      )}
      {help && (
        <Modal
          title="Trust your crew. Mostly."
          close={() => setHelp(false)}
          wide
        >
          <div className="guide-grid">
            <article>
              <Shield />
              <h3>Keep things running.</h3>
              <p>
                Crewmates visit the four marked consoles and complete their
                circuits. Finish every task or vote out every impostor to win.
                Ghosts can still finish tasks.
              </p>
            </article>
            <article>
              <Skull />
              <h3>Be a little suspicious.</h3>
              <p>
                Impostors blend in, use service ducts and eliminate nearby crew.
                Sabotage the reactor to create a 55-second emergency. Crew can
                repair it at the reactor console.
              </p>
            </article>
            <article>
              <MessageCircle />
              <h3>Talk it out.</h3>
              <p>
                Report a body or call a meeting at the central beacon. Discuss,
                then vote or skip. A tie ejects nobody. Ghosts only speak and
                text to ghosts until the match ends.
              </p>
            </article>
          </div>
          <div className="controls-guide">
            <span>
              <kbd>W A S D</kbd> Move
            </span>
            <span>
              <kbd>E</kbd> Interact
            </span>
            <span>
              <kbd>R</kbd> Report
            </span>
            <span>
              <kbd>Tab</kbd> Map
            </span>
            <span>
              <kbd>M</kbd> Mic
            </span>
            <span>
              <kbd>V</kbd> Hold to talk
            </span>
            <span>
              <kbd>Enter</kbd> Chat
            </span>
            <span>
              <kbd>F</kbd> Eliminate
            </span>
            <span>
              <kbd>Q</kbd> Duct
            </span>
          </div>
          <p className="hint">
            On a phone, use the movement pad and action buttons. Landscape gives
            you more room. Enable voice with the microphone button; use
            headphones for the best experience.
          </p>
          <button className="primary full" onClick={() => setHelp(false)}>
            I have a perfectly good alibi <ArrowRight size={18} />
          </button>
        </Modal>
      )}
    </div>
  );
}
function SettingsPanel() {
  const s = useGame();
  return (
    <Modal
      title="Station & Mission Settings"
      close={() => s.set({ settings: false })}
    >
      {s.room && (
        <div className="mission-rules-group">
          <span className="eyebrow">MISSION RULES</span>
          <RoomRules />
          <label className="toggle-line">
            <span>
              <strong>Task Progress Bar</strong>
              <small>
                {s.id === s.room.host
                  ? "Choose when crew progress updates"
                  : `Current rule: ${s.room.taskBarMode || "always"}`}
              </small>
            </span>
            <select
              value={s.room.taskBarMode || "always"}
              disabled={s.id !== s.room.host || s.room.phase !== "lobby"}
              onChange={(e) => act("settings", "taskBarMode", e.target.value)}
            >
              <option value="always">Always (Real-time)</option>
              <option value="meetings">Meetings Only</option>
              <option value="never">Never (Hidden)</option>
            </select>
          </label>
          <label className="toggle-line">
            <span>
              <strong>Visual Tasks</strong>
              <small>Show completion lights and effects only to the player doing the task</small>
            </span>
            <input
              type="checkbox"
              checked={s.room.visualTasks ?? true}
              aria-label="Visual Tasks"
              disabled={s.id !== s.room.host || s.room.phase !== "lobby"}
              onChange={(e) => act("settings", "visualTasks", e.target.checked)}
            />
          </label>
        </div>
      )}
      <label className="toggle-line">
        <span>
          <strong>Station sounds</strong>
          <small>Interaction tones and meeting alerts</small>
        </span>
        <input
          type="checkbox"
          checked={s.sound}
          onChange={(e) => s.set({ sound: e.target.checked })}
        />
      </label>
      <label className="toggle-line">
        <span>
          <strong>Graphics</strong>
          <small>Low reduces shadows and resolution</small>
        </span>
        <select
          value={s.quality}
          onChange={(e) => s.set({ quality: e.target.value as "high" | "low" })}
        >
          <option value="high">High</option>
          <option value="low">Low / mobile</option>
        </select>
      </label>
      <div className="settings-voice">
        <Headphones />
        <h3>A good alibi deserves good audio.</h3>
        <p>
          Headphones recommended. Microphone access needs HTTPS on Android, or
          localhost on desktop.
        </p>
        {s.room && (
          <button
            className="secondary full"
            onClick={() => void voice.enable()}
          >
            Enable / reconnect microphone
          </button>
        )}
      </div>
      <p className="hint">
        Voice changes with the game: everyone in the lobby, nearby living
        players during exploration, all living players in meetings, and ghosts
        with ghosts.
      </p>
      {s.room && (
        <button
          className="danger full"
          onClick={() => {
            s.set({ settings: false });
            leave();
          }}
        >
          Leave expedition
        </button>
      )}
    </Modal>
  );
}
function VoiceBar() {
  const s = useGame();
  return (
    <div className="voice-bar">
      <span className={`voice-dot ${s.voiceStatus === "live" ? "live" : ""}`} />
      <div className="voice-label">
        <strong>
          {s.room?.phase === "playing"
            ? s.room.players.find((p) => p.id === s.id)?.alive
              ? "PROXIMITY"
              : "GHOST CHANNEL"
            : "CREW CHANNEL"}
        </strong>
        <small>
          {s.voiceStatus === "off"
            ? "Tap mic to join voice"
            : s.voiceStatus === "live"
              ? s.muted
                ? "Mic muted · hold V to talk"
                : "Voice connected"
              : s.voiceStatus}
        </small>
      </div>
      <button
        className={`icon ${!s.muted ? "active" : ""}`}
        onClick={() => voice.mute()}
        title="Microphone (M)"
        aria-label="Toggle microphone"
      >
        {s.muted ? <MicOff size={19} /> : <Mic size={19} />}
      </button>
      <button
        className="icon"
        onClick={() => voice.deafen()}
        title="Deafen"
        aria-label="Toggle deafen"
      >
        {s.deafened ? <VolumeX size={19} /> : <Headphones size={19} />}
      </button>
      <button
        className={`talk-button ${s.ptt ? "held" : ""}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          voice.ptt(true);
        }}
        onPointerUp={() => voice.ptt(false)}
        onPointerCancel={() => voice.ptt(false)}
        onLostPointerCapture={() => voice.ptt(false)}
      >
        HOLD <kbd>V</kbd>
      </button>
      {s.playbackBlocked && (
        <button className="audio-unlock" onClick={voice.resume}>
          Tap to hear players
        </button>
      )}
    </div>
  );
}
function ChatPanel() {
  const s = useGame(),
    [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [s.chat.length]);
  if (!s.chatOpen) return null;
  const me = s.room?.players.find((p) => p.id === s.id);
  const allowed = true;
  return (
    <aside className="chat-panel">
      <header>
        <strong>
          <MessageCircle size={15} /> {me?.alive ? "Crew chat" : "Ghost chat"}
        </strong>
        <button
          className="icon"
          aria-label="Close chat"
          onClick={() => s.set({ chatOpen: false })}
        >
          <X size={17} />
        </button>
      </header>
      <div className="chat-messages">
        {s.chat.length ? (
          s.chat.map((m) => (
            <div key={m.id}>
              <span>
                {m.name}{" "}
                <time>
                  {new Date(m.time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
                {m.channel === "ghost" ? " · ghost" : ""}
              </span>
              <p>{m.text}</p>
            </div>
          ))
        ) : (
          <div className="empty">
            <MessageCircle size={22} />
            <p>
              Start with a friendly hello.
              <br />
              Save the accusations for later.
            </p>
          </div>
        )}
        <div ref={end} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) {
            send({ type: "chat", text });
            setText("");
          }
        }}
      >
        <input
          autoFocus
          maxLength={280}
          aria-label="Chat message"
          disabled={!allowed}
          placeholder={
            me?.alive
              ? "Message your crew…"
              : "Ghost message (ghosts only)…"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button aria-label="Send message" disabled={!allowed || !text.trim()}>
          <ArrowRight size={18} />
        </button>
      </form>
    </aside>
  );
}
function Joystick() {
  const [pos, setPos] = useState([0, 0]);
  const pointer = useRef<number | null>(null);
  const joystickEl = useRef<HTMLDivElement>(null);

  function updateCoords(clientX: number, clientY: number) {
    if (!joystickEl.current) return;
    const box = joystickEl.current.getBoundingClientRect();
    let x = clientX - box.left - box.width / 2,
      z = clientY - box.top - box.height / 2;
    const radius = box.width * 0.32;
    const n = Math.max(1, Math.hypot(x, z) / radius);
    x /= n;
    z /= n;
    setPos([x, z]);
    const dead = Math.hypot(x, z) < 5;
    motion.dx = dead ? 0 : x / radius;
    motion.dz = dead ? 0 : z / radius;
  }

  function stop() {
    pointer.current = null;
    setPos([0, 0]);
    motion.dx = motion.dz = 0;
  }

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (pointer.current === e.pointerId) {
        updateCoords(e.clientX, e.clientY);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pointer.current === e.pointerId) {
        stop();
      }
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      motion.dx = motion.dz = 0;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, []);

  return (
    <div
      ref={joystickEl}
      className="joystick"
      aria-label="Movement joystick"
      onPointerDown={(e) => {
        if (pointer.current !== null) return;
        e.preventDefault();
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        updateCoords(e.clientX, e.clientY);
      }}
    >
      <div style={{ transform: `translate(${pos[0]}px,${pos[1]}px)` }} />
      <span>MOVE</span>
    </div>
  );
}
function Lobby() {
  const s = useGame(),
    r = s.room!,
    me = r.players.find((p) => p.id === s.id),
    host = s.id === r.host;
  const [copied, setCopied] = useState(false),
    [addingTestPlayers, setAddingTestPlayers] = useState(false);
  const [draftName, setDraftName] = useState(me?.name || "");
  const [crewOpen, setCrewOpen] = useState(false);
  const lobbyName = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setDraftName(me?.name || "");
  }, [me?.name]);
  const saveName = () => {
    const next = draftName.trim();
    if (!next) {
      setDraftName(me?.name || "");
      return;
    }
    if (next !== me?.name) act("rename", next);
    lobbyName.current?.blur();
  };
  async function addTestPlayers() {
    setAddingTestPlayers(true);
    try {
      await fillLobbyWithTestPlayers(r.code, r.players, r.capacity);
    } catch (error) {
      s.set({
        error:
          error instanceof Error
            ? error.message
            : "Could not add test players.",
      });
    } finally {
      setAddingTestPlayers(false);
    }
  }
  return (
    <div className={`waiting-ui ${crewOpen ? "crew-open" : ""}`}>
      <div className="mobile-lobby-bar">
        <span><strong>{r.code}</strong><small>{r.population}/{r.capacity} crew · {r.public ? "Public" : "Private"}</small></span>
        <button className="secondary" aria-expanded={crewOpen} aria-controls="lobby-crew-panel" onClick={() => setCrewOpen(!crewOpen)}>
          {crewOpen ? <X size={17} /> : <Users size={17} />}{crewOpen ? "Close crew" : "Crew & room"}
        </button>
      </div>
      <form
        className="room-profile"
        onSubmit={(e) => {
          e.preventDefault();
          saveName();
        }}
      >
        <BotIcon small color={me?.color} />
        <label>
          YOUR EXPLORER
          <input
            ref={lobbyName}
            aria-label="Lobby explorer name"
            maxLength={18}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={saveName}
          />
        </label>
        <button
          type="button"
          className="icon"
          aria-label="Edit lobby name"
          onClick={() => {
            lobbyName.current?.focus();
            lobbyName.current?.select();
          }}
        >
          <Pencil size={17} />
        </button>
      </form>
      <aside className="lobby-deck" id="lobby-crew-panel">
        <div className="lobby-title">
          <div>
            <span className="eyebrow">DEPARTURE LOUNGE</span>
            <h2>The usual suspects.</h2>
            <p>Walk around, meet the crew, then ready up.</p>
          </div>
          <button
            className="room-code"
            onClick={() => {
              void navigator.clipboard
                .writeText(r.code)
                .then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                })
                .catch(() =>
                  s.set({ error: `Share this room code: ${r.code}` }),
                );
            }}
          >
            <small>{copied ? "COPIED!" : "INVITE YOUR FRIENDS"}</small>
            <strong>
              {r.code} <Copy size={16} />
            </strong>
          </button>
        </div>
        <div className="room-facts">
          <span>
            DESTINATION<strong>Cloudline Station</strong>
          </span>
          <span>
            CREW
            <strong>
              {r.population} / {r.capacity}
            </strong>
          </span>
          <span>
            PRIVACY<strong>{r.public ? "Public" : "Private"}</strong>
          </span>
        </div>
        <button className="secondary full" onClick={() => s.set({ settings: true })}>
          {host ? "Room settings" : "View room settings"}
        </button>
        <label className="lobby-privacy">Room visibility
          <select aria-label="Lobby room visibility" value={String(r.public)} disabled={!host} onChange={e => act("settings", "public", e.target.value === "true")}>
            <option value="false">Private</option><option value="true">Public</option>
          </select>
        </label>
        <fieldset className="lobby-colors"><legend>Your color</legend>
          {COLORS.map((color, index) => {
            const owner = r.players.find(p => p.color === color && p.id !== s.id);
            return <button key={color} type="button" aria-label={`Color ${index + 1}${owner ? ` · taken by ${owner.name}` : ""}`}
              aria-pressed={me?.color === color} title={owner ? `Taken by ${owner.name}` : `Choose color ${index + 1}`}
              disabled={!!owner} style={{ background: color }} onClick={() => act("color", "", index)}>
              {owner ? "×" : me?.color === color ? "✓" : ""}
            </button>;
          })}
        </fieldset>
        <div className="crew-list">
          {r.players.map((p) => (
            <div className={`crew-card ${p.ready ? "ready" : ""}`} key={p.id}>
              <BotIcon small color={p.color} />
              <span>
                <strong>
                  {p.name}
                  {p.id === s.id ? " (you)" : ""}
                </strong>
                <small>
                  {p.id === r.host ? "HOST · " : ""}
                  {!p.connected
                    ? "Reconnecting…"
                    : p.ready
                      ? "Ready for trouble"
                      : "Getting comfortable"}
                </small>
              </span>
              {p.ready && <Check size={17} />}
              {host && p.id !== s.id && <button className="kick-player" aria-label={`Kick ${p.name}`} onClick={() => act("kick", p.id)}>Kick</button>}
            </div>
          ))}
          {Array.from(
            { length: Math.max(0, r.capacity - r.population) },
            (_, i) => (
              <div className="crew-card vacant" key={`empty${i}`}>
                <Plus size={22} />
                <span>Room for one more</span>
              </div>
            ),
          )}
        </div>
        <button className="secondary full" onClick={openPractice}>Practice at console</button>
        {host && <button className="secondary full fill-crew" disabled={addingTestPlayers} onClick={() => void addTestPlayers()}>
          {addingTestPlayers ? "Adding test players…" : r.population < r.capacity ? `Fill to ${r.capacity} players` : "Ready added players"}
        </button>}
        <div className="lobby-rules-summary">
          <span>TASK BAR: <strong>{(r.taskBarMode || "always").toUpperCase()}</strong></span>
          <i>·</i>
          <span>VISUAL TASKS: <strong>{(r.visualTasks ?? true) ? "ON" : "OFF"}</strong></span>
        </div>
      </aside>
      <div className="lobby-bottom">
        <span>
          <Users size={16} /> {r.population}/{r.capacity} explorers <i />{" "}
          {r.impostors} impostor{r.impostors > 1 ? "s" : ""}
        </span>
        <div>
          <button
            className={me?.ready ? "secondary" : "primary"}
            onClick={() => act("ready")}
          >
            {me?.ready ? (
              <>
                <Check size={18} /> Ready!
              </>
            ) : (
              <>
                I’m ready <Check size={18} />
              </>
            )}
          </button>
          {host && (
            <button
              className="primary"
              disabled={
                r.population < 4 ||
                r.players.some((p) => !p.ready || !p.connected)
              }
              onClick={() => act("start")}
            >
              Launch expedition <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
      <div className="bay-hint">
        HOLD WASD / ARROWS TO MOVE · E AT THE CONSOLE TO PRACTICE
      </div>
    </div>
  );
}
function Meeting() {
  const s = useGame(),
    r = s.room!,
    me = r.players.find((p) => p.id === s.id);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  useEffect(() => {
    setSelectedVote(null);
  }, [r.phase, me?.voted]);
  const selectedPlayer = r.players.find((p) => p.id === selectedVote);
  const canVote = r.phase === "voting" && !!me?.alive && !me.voted;
  return (
    <div className="meeting-overlay">
      <section className="meeting-card">
        <span className="eyebrow">
          <Radio size={15} />{" "}
          {r.phase === "discussion"
            ? "THE FLOOR IS YOURS"
            : r.phase === "voting"
              ? "TIME TO MAKE A CALL"
              : "THE CREW HAS SPOKEN"}
        </span>
        <div className="meeting-heading">
          <h2>
            {r.phase === "discussion"
              ? "Well, this is awkward."
              : r.phase === "voting"
                ? "Who’s acting sus?"
                : "And the verdict is…"}
          </h2>
          <span className="timer">
            {Math.ceil(r.remaining)}
            <small>SEC</small>
          </span>
        </div>
        <p>{r.result}</p>
        <div className="vote-grid">
          {r.players.map((p) => (
            <button
              key={p.id}
              className={`vote-card ${!p.alive ? "dead" : ""} ${p.voted ? "voted" : ""} ${selectedVote === p.id ? "selected" : ""}`}
              disabled={
                r.phase !== "voting" || !me?.alive || me.voted || !p.alive
              }
              aria-pressed={selectedVote === p.id}
              onClick={() => setSelectedVote(p.id)}
            >
              <BotIcon color={p.color} />
              <strong>{p.name}</strong>
              <small>
                {!p.alive
                  ? "Among the clouds"
                  : p.voted
                    ? "Vote locked in"
                    : r.phase === "voting"
                      ? selectedVote === p.id
                        ? "Selected — confirm below"
                        : "Select explorer"
                      : "Listening…"}
              </small>
              {r.phase === "results" && <b>{r.tally[p.id] || 0} votes</b>}
            </button>
          ))}
        </div>
        <div className="meeting-bottom">
          <span>
            {!me?.alive
              ? "Your ghost channel stays private."
              : r.phase === "discussion"
                ? "Share your alibi. Voting begins after discussion."
                : me.voted
                  ? "Your vote is locked in."
                  : selectedVote
                    ? `Confirm ${selectedPlayer?.name || "skipping the vote"}.`
                    : "Choose an explorer, or give everyone another chance."}
          </span>
          {r.phase === "voting" && (
            <div className="vote-actions">
              <button
                className={`secondary ${selectedVote === "skip" ? "selected" : ""}`}
                disabled={!canVote}
                aria-pressed={selectedVote === "skip"}
                onClick={() => setSelectedVote("skip")}
              >
                Skip vote
              </button>
              <button
                className="primary vote-confirm"
                disabled={!canVote || !selectedVote}
                onClick={() => selectedVote && act("vote", selectedVote)}
              >
                Confirm vote <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
function GameHUD() {
  const s = useGame(),
    r = s.room!,
    me = r.players.find((p) => p.id === s.id);
  const [tasksCollapsed, setTasksCollapsed] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 700,
  );
  if (!me) return null;
  const impostor = me.role === "impostor";
  const nearbyTarget = r.players.some(
    (p) =>
      p.id !== s.id &&
      p.alive &&
      p.role !== "impostor" &&
      Math.hypot(p.x - me.x, p.z - me.z) <= 1.8,
  );
  const nearTask = r.tasks.find(
    (t) => !t.done && !s.fakeDone[t.id] && Math.hypot(t.x - me.x, t.z - me.z) <= 2.5,
  );
  const nearBeacon =
    me.alive &&
    Math.hypot(me.x, me.z) < 2.5 &&
    r.emergency > 0 &&
    r.meetingCooldown <= 0 &&
    !r.sabotage;
  const canRepair =
    me.alive && !!r.sabotage && Math.hypot(me.x - 2, me.z + 12) < 2;
  const canInteract = !!nearTask || !!nearBeacon || canRepair;
  const ownAnimation = r.eliminations?.find(
    (e) => e.attacker.id === s.id || e.victim.id === s.id,
  );
  return (
    <>
      <header className="game-top">
        <a className="wordmark" href="#" onClick={(e) => e.preventDefault()}>
          <span className="mark-eyes">••</span> who<span>sus?</span>
        </a>
        <div className="game-location">
          <span className="live-dot" />
          <strong>
            {r.phase === "lobby" ? "DEPARTURE BAY" : "CLOUDLINE STATION"}
          </strong>
          <small>
            {r.code} ·{" "}
            {r.phase === "lobby" ? "PRE-FLIGHT" : r.phase.toUpperCase()}
          </small>
        </div>
        <div className="top-actions">
          <button
            className={`icon ${s.map ? "active" : ""}`}
            aria-label="Toggle map"
            title="Map (Tab)"
            disabled={r.phase === "lobby"}
            onClick={() => s.set({ map: !s.map })}
          >
            <Map size={20} />
          </button>
          <button
            className="icon chat-toggle"
            aria-label="Toggle chat"
            onClick={() => s.set({ chatOpen: !s.chatOpen })}
          >
            <MessageCircle size={20} />
            {s.chat.length > 0 && <i />}
          </button>
          <button
            className="icon"
            aria-label="Settings"
            onClick={() => s.set({ settings: true })}
          >
            <Settings size={20} />
          </button>
        </div>
      </header>
      {r.phase === "lobby" ? (
        <Lobby />
      ) : (
        <>
          <aside className={`task-list ${tasksCollapsed ? "collapsed" : ""}`}>
            <div
              className="task-header"
              onClick={() => setTasksCollapsed(!tasksCollapsed)}
              role="button"
              tabIndex={0}
              title={tasksCollapsed ? "Expand tasks" : "Collapse tasks"}
            >
              <span>
                {impostor ? "A LITTLE TREACHERY" : "A LITTLE TEAMWORK"}
              </span>
              <div className="task-header-right">
                <strong>{Math.round(r.progress * 100)}%</strong>
                <span className="task-toggle-icon">
                  {tasksCollapsed ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronUp size={14} />
                  )}
                </span>
              </div>
            </div>
            {!tasksCollapsed && (
              <>
                <div className="progress">
                  <i style={{ width: `${r.progress * 100}%` }} />
                </div>
                <h3>
                  {!me.alive
                    ? "Your shift isn’t over."
                    : impostor
                      ? "Make yourself believable."
                      : "Keep the station alive."}
                </h3>
                {!me.alive && (
                  <p className="ghost-note">
                    You’re a ghost.{" "}
                    {impostor
                      ? "Watch the mystery unfold."
                      : "Finish your tasks and help your crew."}
                  </p>
                )}
                {impostor ? (
                  <p>
                    Blend in. Create a distraction.
                    <br />
                    Eliminate the crew without being caught.
                  </p>
                ) : (
                  r.tasks.map((t) => (
                    <div
                      className={`task-row ${t.done ? "done" : ""}`}
                      key={t.id}
                    >
                      <span>
                        {t.done ? (
                          <Check size={13} />
                        ) : (
                          <span className="task-dot" />
                        )}
                      </span>
                      <div>
                        <strong>{t.name}</strong>
                        <small>{t.room}</small>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </aside>
          {r.sabotage > 0 && (
            <div className="sabotage-banner">
              <Zap size={20} />
              <span>
                REACTOR UNSTABLE <small>Repair the reactor console!</small>
              </span>
              <strong>{Math.ceil(r.sabotage)}s</strong>
            </div>
          )}
          {s.map && (
            <div className="map-legend">
              <Map size={17} />
              <span>STATION OVERVIEW · Task consoles glow in each room</span>
            </div>
          )}
          {r.phase === "playing" && (
            <div className="action-buttons">
              {impostor && me.alive && (
                <>
                  <HoldButton
                    className="action danger"
                    disabled={
                      r.killCooldown > 0 || !nearbyTarget || r.movementLock > 0
                    }
                    onClick={eliminate}
                  >
                    <Skull />
                    <span>
                      {r.killCooldown > 0
                        ? `${Math.ceil(r.killCooldown)}s`
                        : nearbyTarget
                          ? "Eliminate"
                          : "Get closer"}
                    </span>
                    <kbd>F</kbd>
                  </HoldButton>
                  <button
                    className="action"
                    disabled={r.sabotageCooldown > 0 || r.sabotage > 0}
                    onClick={() => act("sabotage")}
                  >
                    <Zap />
                    <span>
                      {r.sabotageCooldown > 0
                        ? `${Math.ceil(r.sabotageCooldown)}s`
                        : "Sabotage"}
                    </span>
                  </button>
                  <button className="action" onClick={() => act("vent")}>
                    <DoorOpen />
                    <span>{r.vent >= 0 ? "Exit duct" : "Service duct"}</span>
                    <kbd>Q</kbd>
                  </button>
                  {r.vent >= 0 && (
                    <button
                      className="action"
                      onClick={() => act("vent", "next")}
                    >
                      <ArrowRight />
                      <span>Next duct</span>
                    </button>
                  )}
                </>
              )}
              {me.alive && (
                <button
                  className="action"
                  onClick={report}
                  disabled={
                    r.movementLock > 0 ||
                    !r.bodies.some(
                      (b) => Math.hypot(b.x - me.x, b.z - me.z) <= 2.5,
                    )
                  }
                >
                  <Radio />
                  <span>Report</span>
                  <kbd>R</kbd>
                </button>
              )}
              <HoldButton
                className="action use"
                onClick={interact}
                disabled={!canInteract || r.movementLock > 0}
              >
                <Sparkles />
                <span>
                  {canRepair
                    ? "Repair"
                    : nearTask
                      ? "Do task"
                      : nearBeacon
                        ? "Meeting"
                        : "Interact"}
                </span>
                <kbd>E</kbd>
              </HoldButton>
            </div>
          )}
        </>
      )}
      <div className="game-bottom">
        <VoiceBar />
        <span className="movement-hint">
          Hold <kbd>W A S D / ↑ ← ↓ →</kbd> to move <i /> <kbd>E</kbd> to
          interact
        </span>
        <span className="connection">
          <Wifi size={14} />
          {s.status === "connected" ? "CONNECTED" : "RECONNECTING"}
        </span>
      </div>
      {["lobby", "playing"].includes(r.phase) &&
        !r.challenge &&
        !s.settings &&
        !r.movementLock && <Joystick />}
      <ChatPanel />
      {r.phase === "reveal" && (
        <div className={`role-reveal ${impostor ? "traitor" : ""}`}>
          <span className="eyebrow">KEEP THIS BETWEEN US.</span>
          <BotIcon color={me.color} />
          <h2>You’re {impostor ? "the impostor." : "a crewmate."}</h2>
          <p>
            {impostor
              ? "A friendly face. A very different agenda."
              : "A little teamwork will get you home."}
          </p>
          <span className="tag">
            {Math.ceil(r.remaining)} · YOUR EXPEDITION IS ABOUT TO BEGIN
          </span>
        </div>
      )}
      {["discussion", "voting", "results"].includes(r.phase) && <Meeting />}
      {ownAnimation && (
        <div
          className={`elimination-caption ${ownAnimation.victim.id === s.id ? "victim" : ""}`}
          role="status"
        >
          <span>{ELIMINATION_NAMES[ownAnimation.style]}</span>
          <strong>
            {ownAnimation.victim.id === s.id
              ? `${ownAnimation.attacker.name} caught you!`
              : `${ownAnimation.victim.name} eliminated`}
          </strong>
          <small>
            {ownAnimation.victim.id === s.id
              ? "Your ghost can still help the crew."
              : "Better have a good alibi."}
          </small>
        </div>
      )}
      {r.phase === "gameover" && !r.eliminations?.length && (
        <div className="meeting-overlay">
          <section className="end-card">
            <div className="victory-icon">
              {r.winner === "crew" ? <Shield size={42} /> : <Skull size={42} />}
            </div>
            <span className="eyebrow">EXPEDITION COMPLETE</span>
            <h2>
              {r.winner === "crew"
                ? "Trust wins. This time."
                : "A very convincing alibi."}
            </h2>
            <p>
              {r.winner === "crew"
                ? "The crewmates saved Cloudline Station."
                : "The impostors got the better of this crew."}
            </p>
            <h3>
              {(impostor ? "impostor" : "crew") === r.winner
                ? "VICTORY"
                : "BETTER LUCK NEXT EXPEDITION"}
            </h3>
            <div className="reveal-crew">
              {r.players.map((p) => (
                <div key={p.id}>
                  <BotIcon small color={p.color} />
                  <strong>{p.name}</strong>
                  <small className={p.role === "impostor" ? "error-text" : ""}>
                    {p.role === "impostor" ? "Impostor" : "Crewmate"}
                  </small>
                </div>
              ))}
            </div>
            <p className="hint">
              All voice channels are open again. Compare your stories.
            </p>
            {s.id === r.host ? (
              <button className="primary full" onClick={() => act("rematch")}>
                One more expedition? <ArrowRight size={18} />
              </button>
            ) : (
              <p>Waiting for the host to start a rematch.</p>
            )}
            <button className="text-button" onClick={leave}>
              Back to the main menu
            </button>
          </section>
        </div>
      )}
      {s.practiceOpen && r.phase === "lobby" && !s.fakeChallenge && <PracticePanel />}
      {((r.challenge && r.phase === "playing") || s.fakeChallenge) && (
        <UniversalTaskPanel />
      )}
    </>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="webgl-error">
        <h2>The station needs WebGL.</h2>
        <p>Enable hardware acceleration and reload your browser.</p>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const s = useGame(),
    [name, setName] = useState(() => {
      const savedName = localStorage.getItem("whosus-name");
      return savedName && savedName !== "Miso" ? savedName : makeDefaultName();
    }),
    [color, setColor] = useState(0),
    [hat, setHat] = useState("sprout");
  useEffect(() => initializeNetwork(), []);
  useEffect(() => {
    localStorage.setItem("whosus-name", name);
  }, [name]);
  const roomName = s.room?.players.find((p) => p.id === s.id)?.name;
  useEffect(() => {
    if (roomName) setName(roomName);
  }, [roomName]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select,dialog"))
        return;
      if (e.code === "Tab") {
        e.preventDefault();
        if (!e.repeat && useGame.getState().room?.phase !== "lobby")
          useGame.setState({ map: !useGame.getState().map });
        return;
      }
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "Space",
        ].includes(e.code)
      )
        e.preventDefault();
      motion.keys.add(e.code);
      if (e.code === "KeyF") {
        eliminate();
        return;
      }
      if (e.code === "KeyE") {
        if (
          !e.repeat ||
          STATIONS.some((t) => Math.hypot(t.x - motion.x, t.z - motion.z) < 2)
        )
          interact();
        return;
      }
      if (e.repeat) return;
      if (e.code === "KeyV") voice.ptt(true);
      if (e.code === "KeyM") voice.mute();
      if (e.code === "KeyR") report();
      if (e.code === "KeyQ") act("vent");
      if (e.code === "Enter") useGame.setState({ chatOpen: true });
    };
    const up = (e: KeyboardEvent) => {
      motion.keys.delete(e.code);
      if (e.code === "KeyV") voice.ptt(false);
    };
    const reset = () => {
      motion.keys.clear();
      motion.dx = motion.dz = 0;
      voice.ptt(false);
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, []);
  useEffect(() => {
    if (!s.error) return;
    const timer = setTimeout(() => useGame.setState({ error: "" }), 7000);
    return () => clearTimeout(timer);
  }, [s.error]);
  return (
    <div
      className={`app ${s.room ? "in-game" : "at-menu"} ${s.room?.phase === "lobby" ? "in-lobby" : ""}`}
    >
      <div className="scene-wrap">
        <SceneBoundary>
          <Scene menu={!s.room} color={color} hat={hat} />
        </SceneBoundary>
      </div>
      {s.room ? (
        <GameHUD />
      ) : (
        <Menu {...{ name, setName, color, setColor, hat, setHat }} />
      )}
      {s.settings && <SettingsPanel />}
      {(s.error || s.voiceError) && (
        <div className="toast" role="alert">
          <span>{s.error || s.voiceError}</span>
          <button
            aria-label="Dismiss error"
            onClick={() => s.set({ error: "", voiceError: "" })}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {s.status === "connecting" && (
        <div className="connecting">
          <span className="live-dot" /> Connecting to your expedition…
        </div>
      )}
    </div>
  );
}
