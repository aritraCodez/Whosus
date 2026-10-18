import { useState, useEffect, useRef, useCallback } from "react";
import type { Challenge } from "./types";
import { Modal } from "./components/Modal";
import { act } from "./network";
import { useGame } from "./store";
import { STATIONS } from "./world";
import {
  Check,
  CreditCard,
  Zap,
  Crosshair,
  ShieldAlert,
  Compass,
  Wind,
  Activity,
  Sliders,
  Fuel,
  Radio,
  Sparkles,
} from "lucide-react";

// Sound effects generator using Web Audio API for rich feedback
function playTaskSound(type: "click" | "beep" | "success" | "laser" | "buzz" | "spark") {
  if (!useGame.getState().sound) return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    osc.onended = () => { void ctx.close(); };
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === "click") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === "beep") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === "laser") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === "spark") {
      osc.type = "square";
      osc.frequency.setValueAtTime(1400, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === "success") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (type === "buzz") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch {
    // AudioContext not allowed or unsupported
  }
}

// 1. SEQUENCE / SIGNAL CIRCUIT MINIGAME
function SequenceGame({
  c,
  finish,
}: {
  c: Challenge;
  finish: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [localStep, setLocalStep] = useState(c.step || 0);

  const symbols = ["●", "◆", "▲", "✦"];
  const handlePress = (idx: number) => {
    if (busy) return;
    playTaskSound("click");
    setBusy(true);

    if (c.fake || c.practice) {
      if (idx === c.sequence[localStep]) {
        const next = localStep + 1;
        setLocalStep(next);
        if (next >= c.sequence.length) {
          playTaskSound("success");
          setTimeout(finish, 400);
          return;
        }
      } else {
        playTaskSound("buzz");
        setLocalStep(0);
      }
      setTimeout(() => setBusy(false), 300);
    } else {
      act("task_step", c.nonce, idx);
      setTimeout(() => setBusy(false), 350);
    }
  };

  const currentStep = c.fake || c.practice ? localStep : c.step;

  return (
    <div className="task-game sequence-game">
      <div className="task-instructions">
        <h3>Follow the signal sequence</h3>
        <p>Tap the symbols in order to calibrate the station relay.</p>
      </div>

      <div className="sequence-display">
        {c.sequence.map((v, i) => (
          <span
            key={i}
            className={`seq-node ${i < currentStep ? "complete" : i === currentStep ? "current pulse" : ""}`}
          >
            {symbols[v]}
          </span>
        ))}
      </div>

      <div className="circuit-buttons">
        {symbols.map((sym, idx) => (
          <button
            key={sym}
            disabled={busy || currentStep >= c.sequence.length}
            className="circuit-btn"
            onClick={() => handlePress(idx)}
          >
            {sym}
          </button>
        ))}
      </div>

      <div className="task-meter">
        <i style={{ width: `${(currentStep / c.sequence.length) * 100}%` }} />
      </div>
    </div>
  );
}

// 2. SWIPE CARD MINIGAME
function SwipeGame({ finish }: { finish: () => void }) {
  const [status, setStatus] = useState<"idle" | "reading" | "fast" | "slow" | "accepted">("idle");
  const [progress, setProgress] = useState(0);
  const startTime = useRef(0);
  const isDragging = useRef(false);

  const startSwipe = () => {
    startTime.current = Date.now();
    isDragging.current = true;
    setStatus("reading");
    playTaskSound("beep");
  };

  const handleDrag = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setProgress(val);
    if (val === 100 && isDragging.current) {
      isDragging.current = false;
      const duration = (Date.now() - startTime.current) / 1000;
      if (duration < 0.25) {
        setStatus("fast");
        playTaskSound("buzz");
        setTimeout(() => { setProgress(0); setStatus("idle"); }, 1200);
      } else if (duration > 1.8) {
        setStatus("slow");
        playTaskSound("buzz");
        setTimeout(() => { setProgress(0); setStatus("idle"); }, 1200);
      } else {
        setStatus("accepted");
        playTaskSound("success");
        setTimeout(finish, 800);
      }
    }
  };

  return (
    <div className="task-game swipe-game">
      <div className="card-reader">
        <div className="reader-header">
          <CreditCard size={18} />
          <span>ADMIN ACCESS PORTAL</span>
          <div className="status-lights">
            <span className={`light red ${status === "idle" || status === "fast" || status === "slow" ? "on" : ""}`} />
            <span className={`light yellow ${status === "reading" ? "on" : ""}`} />
            <span className={`light green ${status === "accepted" ? "on" : ""}`} />
          </div>
        </div>

        <div className="reader-screen">
          {status === "idle" && "PLEASE SWIPE CARD"}
          {status === "reading" && "READING MAGNETIC STRIP..."}
          {status === "fast" && "TOO FAST. TRY AGAIN."}
          {status === "slow" && "TOO SLOW. TRY AGAIN."}
          {status === "accepted" && "ACCEPTED. THANK YOU."}
        </div>

        <div className="card-slot">
          <div className="card-track">
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              disabled={status === "accepted"}
              onPointerDown={startSwipe}
              onChange={handleDrag}
              className="card-slider"
            />
            <div
              className={`crew-id-card ${progress > 10 ? "swiping" : ""}`}
              style={{ transform: `translateX(${progress * 2.2}px)` }}
            >
              <div className="id-photo" />
              <div className="id-details">
                <strong>CREW ID</strong>
                <span>#4902-A</span>
              </div>
            </div>
          </div>
        </div>

        <div className="swipe-hint">
          <span>Drag card smoothly from left to right</span>
        </div>
      </div>
    </div>
  );
}

// 3. FIX WIRING MINIGAME
function WiresGame({ finish }: { finish: () => void }) {
  const COLORS = ["#f47785", "#75b8ed", "#f6bd4f", "#e69ed0"];
  const COLOR_NAMES = ["red", "blue", "yellow", "pink"];

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [connections, setConnections] = useState<Record<number, number>>({});
  const rightOrder = useRef([2, 0, 3, 1]); // Shuffled right terminals

  const handleLeftClick = (leftIdx: number) => {
    playTaskSound("click");
    setSelectedLeft(leftIdx);
  };

  const handleRightClick = (rightIdx: number) => {
    if (selectedLeft === null) return;
    const rightColor = rightOrder.current[rightIdx];

    if (selectedLeft === rightColor) {
      // Valid connection!
      playTaskSound("spark");
      const next = { ...connections, [selectedLeft]: rightIdx };
      setConnections(next);
      setSelectedLeft(null);
      if (Object.keys(next).length === 4) {
        playTaskSound("success");
        setTimeout(finish, 700);
      }
    } else {
      playTaskSound("buzz");
      setSelectedLeft(null);
    }
  };

  return (
    <div className="task-game wires-game">
      <div className="task-instructions">
        <h3>Match and reconnect color conduits</h3>
        <p>Select a wire on the left, then connect it to its matching color terminal.</p>
      </div>

      <div className="wires-junction">
        {/* Left Terminals */}
        <div className="terminals-col left">
          {COLORS.map((col, idx) => {
            const isConnected = connections[idx] !== undefined;
            const isSelected = selectedLeft === idx;
            return (
              <button
                key={idx}
                className={`terminal-btn ${isSelected ? "selected" : ""} ${isConnected ? "connected" : ""}`}
                style={{ "--wire-color": col } as React.CSSProperties}
                disabled={isConnected}
                onClick={() => handleLeftClick(idx)}
              >
                <span className="wire-stub" style={{ background: col }} />
                <span className="terminal-label">{COLOR_NAMES[idx].toUpperCase()}</span>
              </button>
            );
          })}
        </div>

        {/* Center Canvas / SVG Connections */}
        <div className="wires-center">
          <svg className="wires-svg" viewBox="0 0 100 160">
            {Object.entries(connections).map(([left, right]) => {
              const y1 = 20 + Number(left) * 40;
              const y2 = 20 + Number(right) * 40;
              const color = COLORS[Number(left)];
              return (
                <path
                  key={left}
                  d={`M 0,${y1} C 50,${y1} 50,${y2} 100,${y2}`}
                  stroke={color}
                  strokeWidth="5"
                  fill="none"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
        </div>

        {/* Right Terminals */}
        <div className="terminals-col right">
          {rightOrder.current.map((colIdx, idx) => {
            const isConnected = Object.values(connections).includes(idx);
            const col = COLORS[colIdx];
            return (
              <button
                key={idx}
                className={`terminal-btn right ${isConnected ? "connected" : ""}`}
                style={{ "--wire-color": col } as React.CSSProperties}
                disabled={isConnected}
                onClick={() => handleRightClick(idx)}
              >
                <span className="terminal-label">{COLOR_NAMES[colIdx].toUpperCase()}</span>
                <span className="wire-stub" style={{ background: col }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 4. ENTER ID CODE MINIGAME
function KeypadGame({ finish }: { finish: () => void }) {
  const [targetCode] = useState(() =>
    String(Math.floor(10000 + Math.random() * 90000)),
  );
  const [entered, setEntered] = useState("");
  const [success, setSuccess] = useState(false);

  const pressDigit = (digit: string) => {
    if (success || entered.length >= 5) return;
    playTaskSound("beep");
    const next = entered + digit;
    setEntered(next);
  };

  const clear = () => {
    playTaskSound("click");
    setEntered("");
  };

  const check = () => {
    if (entered === targetCode) {
      setSuccess(true);
      playTaskSound("success");
      setTimeout(finish, 800);
    } else {
      playTaskSound("buzz");
      setEntered("");
    }
  };

  return (
    <div className="task-game keypad-game">
      <div className="keypad-unit">
        <div className="sticky-note">
          <small>SEC ID CODE</small>
          <strong>{targetCode}</strong>
        </div>

        <div className={`keypad-display ${success ? "success" : ""}`}>
          <span>{entered.padEnd(5, "•")}</span>
          {success && <Check className="check-icon" size={20} />}
        </div>

        <div className="keypad-grid">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} onClick={() => pressDigit(d)} className="key-btn">
              {d}
            </button>
          ))}
          <button onClick={clear} className="key-btn action-key clear">
            CLR
          </button>
          <button onClick={() => pressDigit("0")} className="key-btn">
            0
          </button>
          <button onClick={check} className="key-btn action-key enter">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

// 5. PRIME SHIELDS MINIGAME (Visual Task)
function ShieldsGame({ finish }: { finish: () => void }) {
  // 7 hexes: indices 0 to 6. Some initially red (false), goal is all true.
  const [shields, setShields] = useState<boolean[]>([false, true, false, false, true, false, false]);

  const toggleHex = (idx: number) => {
    playTaskSound("spark");
    const next = [...shields];
    next[idx] = true;
    setShields(next);

    if (next.every(Boolean)) {
      playTaskSound("success");
      setTimeout(finish, 800);
    }
  };

  return (
    <div className="task-game shields-game">
      <div className="task-instructions">
        <h3>Engage magnetic shield generators</h3>
        <p>Tap all red depleted shield nodes to activate them.</p>
      </div>

      <div className="hex-grid">
        {shields.map((active, i) => (
          <button
            key={i}
            className={`hex-tile ${active ? "active" : "depleted"}`}
            disabled={active}
            onClick={() => toggleHex(i)}
          >
            <ShieldAlert size={24} />
            <span>{active ? "ONLINE" : "OFFLINE"}</span>
          </button>
        ))}
      </div>

      <div className="shields-status">
        STATUS: <strong>{shields.filter(Boolean).length} / 7 NODES ENGAGED</strong>
      </div>
    </div>
  );
}

// 6. CHART COURSE MINIGAME
function CourseGame({ finish }: { finish: () => void }) {
  const [step, setStep] = useState(0);
  const waypoints = [
    { x: 15, y: 70, label: "Point Alpha" },
    { x: 40, y: 30, label: "Point Beta" },
    { x: 70, y: 60, label: "Point Gamma" },
    { x: 88, y: 25, label: "Cloudline Dock" },
  ];

  const clickWaypoint = (idx: number) => {
    if (idx !== step) return;
    playTaskSound("beep");
    const next = step + 1;
    setStep(next);

    if (next >= waypoints.length) {
      playTaskSound("success");
      setTimeout(finish, 800);
    }
  };

  return (
    <div className="task-game course-game">
      <div className="task-instructions">
        <h3>Plot orbital trajectory</h3>
        <p>Confirm the navigational path through each coordinate in sequence.</p>
      </div>

      <div className="course-chart">
        <svg className="course-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          {waypoints.slice(0, step).map((wp, i) => {
            if (i === 0) return null;
            const prev = waypoints[i - 1];
            return (
              <line
                key={i}
                x1={prev.x}
                y1={prev.y}
                x2={wp.x}
                y2={wp.y}
                stroke="#6ad9c5"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
            );
          })}
        </svg>

        {waypoints.map((wp, idx) => {
          const isDone = idx < step;
          const isCurrent = idx === step;
          return (
            <button
              key={idx}
              className={`waypoint-node ${isDone ? "done" : ""} ${isCurrent ? "current pulse" : ""}`}
              style={{ left: `${wp.x}%`, top: `${wp.y}%` }}
              disabled={!isCurrent}
              onClick={() => clickWaypoint(idx)}
            >
              <Compass size={18} />
              <span className="wp-badge">{idx + 1}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 7. CLEAR ASTEROIDS MINIGAME (Visual Task)
function AsteroidsGame({ finish }: { finish: () => void }) {
  const [destroyed, setDestroyed] = useState(0);
  const total = 5;

  const [asteroids, setAsteroids] = useState(() =>
    Array.from({ length: total }, (_, i) => ({
      id: i,
      x: 15 + Math.random() * 70,
      y: 15 + Math.random() * 65,
      size: 26 + Math.random() * 16,
      hit: false,
      exploding: false,
    }))
  );
  const hitTargets = useRef(new Set<number>());

  const hitAsteroid = (id: number) => {
    if (hitTargets.current.has(id)) return;
    hitTargets.current.add(id);
    playTaskSound("laser");
    setAsteroids((prev) =>
      prev.map((a) => (a.id === id ? { ...a, exploding: true } : a))
    );
    setTimeout(() => {
      setAsteroids((prev) =>
        prev.map((a) => (a.id === id ? { ...a, hit: true } : a))
      );
    }, 450);
    const nextCount = hitTargets.current.size;
    setDestroyed(nextCount);

    if (nextCount >= total) {
      playTaskSound("success");
      setTimeout(finish, 800);
    }
  };

  return (
    <div className="task-game asteroids-game">
      <div className="gunner-hud">
        <div className="hud-crosshair">
          <Crosshair size={32} />
        </div>
        <div className="hud-stats">
          <span>TARGETS CLEARED</span>
          <strong>{destroyed} / {total}</strong>
        </div>

        <div className="radar-field">
          {asteroids.map((ast) => (
            !ast.hit && (
              <button
                key={ast.id}
                style={{
                  left: `${ast.x}%`,
                  top: `${ast.y}%`,
                  width: `${ast.size}px`,
                  height: `${ast.size}px`,
                  animationDelay: `${-ast.id * 0.65}s`,
                }}
                className={`asteroid-btn ${ast.exploding ? "exploding" : ""}`}
                onClick={() => hitAsteroid(ast.id)}
                disabled={ast.exploding}
                aria-label="Destroy asteroid"
              >
                ☄
              </button>
            )
          ))}
        </div>
      </div>
    </div>
  );
}

// 8. CLEAN O2 FILTER MINIGAME
function CleanGame({ finish }: { finish: () => void }) {
  const [cleaned, setCleaned] = useState(0);
  const total = 4;
  const [leaves, setLeaves] = useState(() =>
    Array.from({ length: total }, (_, i) => ({
      id: i,
      x: 20 + Math.random() * 55,
      y: 20 + Math.random() * 55,
      removed: false,
      ejecting: false,
    }))
  );
  const ejectedLeaves = useRef(new Set<number>());

  const ejectLeaf = (id: number) => {
    if (ejectedLeaves.current.has(id)) return;
    ejectedLeaves.current.add(id);
    playTaskSound("spark");
    setLeaves((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ejecting: true } : l))
    );
    setTimeout(() => {
      setLeaves((prev) =>
        prev.map((l) => (l.id === id ? { ...l, removed: true } : l))
      );
    }, 550);
    const next = ejectedLeaves.current.size;
    setCleaned(next);

    if (next >= total) {
      playTaskSound("success");
      setTimeout(finish, 800);
    }
  };

  return (
    <div className="task-game clean-game">
      <div className="task-instructions">
        <h3>Flush intake filter</h3>
        <p>Tap and eject the botanical debris from the oxygen vent.</p>
      </div>

      <div className="vent-chamber">
        <div className="chute-target">
          <Wind size={24} />
          <span>EJECT CHUTE</span>
        </div>

        {leaves.map((leaf) => (
          !leaf.removed && (
            <button
              key={leaf.id}
              className={`debris-item ${leaf.ejecting ? "ejecting" : "floating"}`}
              style={{
                left: `${leaf.x}%`,
                top: `${leaf.y}%`,
                animationDelay: `${-leaf.id * 0.8}s`,
              }}
              disabled={leaf.ejecting}
              aria-label="Eject filter debris"
              onClick={() => ejectLeaf(leaf.id)}
            >
              🍂
            </button>
          )
        ))}
      </div>

      <div className="task-meter">
        <i style={{ width: `${(cleaned / total) * 100}%` }} />
      </div>
    </div>
  );
}

// 9. SUBMIT SCAN MINIGAME (Visual Task)
function ScanGame({ finish }: { finish: () => void }) {
  const s = useGame();
  const me = s.room?.players.find((p) => p.id === s.id);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    playTaskSound("beep");
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          playTaskSound("success");
          setTimeout(finish, 600);
          return 100;
        }
        return prev + 10;
      });
    }, 280);

    return () => clearInterval(interval);
  }, [finish]);

  return (
    <div className="task-game scan-game">
      <div className="medbay-scanner">
        <div className="scan-beam-visual" />
        <Activity size={32} className="scan-icon" />

        <div className="bio-readout">
          <h4>BIOMETRIC SCAN IN PROGRESS</h4>
          <div className="bio-row">
            <span>SUBJECT:</span>
            <strong>{me?.name || "EXPLORER"}</strong>
          </div>
          <div className="bio-row">
            <span>ID:</span>
            <strong>#9904-BIO</strong>
          </div>
          <div className="bio-row">
            <span>STATUS:</span>
            <strong className="clean-status">NOMINAL CREWMATE</strong>
          </div>
        </div>

        <div className="task-meter">
          <i style={{ width: `${progress}%` }} />
        </div>
        <small>{progress < 100 ? "Hold position on the diagnostic pad…" : "Diagnostic Complete."}</small>
      </div>
    </div>
  );
}

// 10. DIVERT POWER MINIGAME
function DivertGame({ finish }: { finish: () => void }) {
  const [switches, setSwitches] = useState([false, false, false, false]);
  const targetIdx = 2; // Divert to target conduit

  const toggle = (idx: number) => {
    playTaskSound("click");
    const next = [...switches];
    next[idx] = !next[idx];
    setSwitches(next);

    if (idx === targetIdx && next[idx]) {
      playTaskSound("success");
      setTimeout(finish, 800);
    }
  };

  return (
    <div className="task-game divert-game">
      <div className="task-instructions">
        <h3>Divert auxiliary power</h3>
        <p>Push breaker #3 to energize Cloudline secondary sub-systems.</p>
      </div>

      <div className="breakers-panel">
        {switches.map((on, i) => (
          <div key={i} className="breaker-slot">
            <span className="slot-num">CH 0{i + 1}</span>
            <button
              className={`breaker-switch ${on ? "on" : "off"} ${i === targetIdx ? "target" : ""}`}
              onClick={() => toggle(i)}
            >
              <Sliders size={20} />
              <span>{on ? "ROUTE" : "IDLE"}</span>
            </button>
            {i === targetIdx && <span className="target-indicator">TARGET</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// 11. FUEL ENGINES MINIGAME
function FuelGame({ finish }: { finish: () => void }) {
  const [level, setLevel] = useState(0);
  const holding = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  useEffect(() => () => clearInterval(timer.current), []);

  const startFill = () => {
    if (holding.current) return;
    holding.current = true;
    playTaskSound("beep");
    timer.current = setInterval(() => {
      setLevel((prev) => {
        if (prev >= 100) {
          clearInterval(timer.current);
          playTaskSound("success");
          setTimeout(finish, 600);
          return 100;
        }
        return prev + 5;
      });
    }, 120);
  };

  const stopFill = () => {
    holding.current = false;
    clearInterval(timer.current);
  };

  return (
    <div className="task-game fuel-game">
      <div className="fuel-canister">
        <div className="canister-gauge">
          <div className="fuel-liquid" style={{ height: `${level}%` }}>
            <span className="bubble b1" />
            <span className="bubble b2" />
          </div>
          <span className="fill-mark">MAX</span>
        </div>

        <div className="fuel-controls">
          <button
            className="fuel-dispense-btn"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); startFill(); }}
            onPointerUp={stopFill}
            onPointerCancel={stopFill}
            onLostPointerCapture={stopFill}
            disabled={level >= 100}
          >
            <Fuel size={28} />
            <strong>{level >= 100 ? "TANK FULL" : "HOLD TO DISPENSE"}</strong>
          </button>
          <small>{level}% Transferred</small>
        </div>
      </div>
    </div>
  );
}

// 12. CALIBRATE RELAYS MINIGAME
function DialGame({ finish }: { finish: () => void }) {
  const [val, setVal] = useState(15);
  const target = 75;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVal(v);
    if (Math.abs(v - target) <= 2) {
      playTaskSound("success");
      setTimeout(finish, 700);
    } else {
      playTaskSound("click");
    }
  };

  const locked = Math.abs(val - target) <= 2;

  return (
    <div className="task-game dial-game">
      <div className="task-instructions">
        <h3>Calibrate Security Relay</h3>
        <p>Rotate the tuner to align frequency to 75.0 MHz.</p>
      </div>

      <div className="dial-display">
        <Radio size={28} />
        <div className="dial-readout">
          <strong>{val}.0 MHz</strong>
          <span className={locked ? "locked" : ""}>{locked ? "LOCKED" : "SEARCHING..."}</span>
        </div>
      </div>

      <div className="dial-control">
        <input
          type="range"
          min="0"
          max="100"
          value={val}
          disabled={locked}
          onChange={handleChange}
          className="dial-slider"
        />
      </div>
    </div>
  );
}

// MASTER TASK PANEL COMPONENT
export function PracticePanel() {
  const s = useGame();
  return <Modal title="Practice station" close={() => s.set({ practiceOpen: false })} wide>
    <p className="muted">Try any console before launch. Practice does not count toward the mission.</p>
    <div className="practice-grid">{STATIONS.map(t => <button key={t.id} className="secondary" onClick={() => s.set({
      fakeChallenge: { ...t, done: false, nonce: `practice_${Date.now()}`, sequence: [2,0,3,1], step: 0, started: Date.now()/1000, practice: true },
    })}><strong>{t.name}</strong><small>{t.room} · {t.category}</small></button>)}</div>
  </Modal>;
}

export function UniversalTaskPanel() {
  const s = useGame();
  const c = s.room?.challenge || s.fakeChallenge;
  if (!c) return null;
  return <TaskSession key={c.nonce} c={c} />;
}

function TaskSession({ c }: { c: Challenge }) {
  const s = useGame();
  const completed = useRef(false);
  useEffect(() => { completed.current = false; return () => { completed.current = true; }; }, []);

  const isFake = !!c.fake;

  const closeTask = useCallback(() => {
    if (isFake || c.practice) s.set({ fakeChallenge: null });
    else act("task_cancel");
  }, [isFake, c.practice, s.set]);

  const handleFinish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    if (c.practice) {
      useGame.setState({ fakeChallenge: null });
    } else if (isFake) {
      s.set({
        fakeChallenge: null,
        fakeDone: { ...useGame.getState().fakeDone, [c.id]: true },
      });
    } else {
      act("task_step", c.nonce);
    }
  }, [isFake, s.set, c.practice, c.id, c.nonce]);

  return (
    <Modal
      title={c.name}
      close={closeTask}
      wide
    >
      <div className={`universal-task-console ${isFake ? "fake-task" : ""}`}>
        <div className="task-meta-bar">
          <span className="room-tag">{c.room.toUpperCase()}</span>
          {c.category && <span className={`category-tag ${c.category}`}>{c.category.toUpperCase()} TASK</span>}
          {c.visual && <span className="visual-tag"><Sparkles size={12} /> VISUAL</span>}
          {isFake && <span className="fake-alert-tag">FAKE TASK (NO PROGRESS)</span>}
          {c.practice && <span className="visual-tag">PRACTICE · NO MISSION PROGRESS</span>}
        </div>

        {c.kind === "sequence" && <SequenceGame c={c} finish={handleFinish} />}
        {c.kind === "swipe" && <SwipeGame finish={handleFinish} />}
        {c.kind === "wires" && <WiresGame finish={handleFinish} />}
        {c.kind === "keypad" && <KeypadGame finish={handleFinish} />}
        {c.kind === "shields" && <ShieldsGame finish={handleFinish} />}
        {c.kind === "course" && <CourseGame finish={handleFinish} />}
        {c.kind === "asteroids" && <AsteroidsGame finish={handleFinish} />}
        {c.kind === "clean" && <CleanGame finish={handleFinish} />}
        {c.kind === "scan" && <ScanGame finish={handleFinish} />}
        {c.kind === "divert" && <DivertGame finish={handleFinish} />}
        {c.kind === "fuel" && <FuelGame finish={handleFinish} />}
        {c.kind === "dial" && <DialGame finish={handleFinish} />}
      </div>
    </Modal>
  );
}
