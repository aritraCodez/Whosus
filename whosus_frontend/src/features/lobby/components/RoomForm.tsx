import { GameSelect } from "@/components/ui/GameSelect";
import { Modal } from "@/components/ui/Modal";
import { backendApiUrl } from "@/config/backend";
import { useAppearance } from "@/features/appearance/model/appearance-store";
import {
connect
} from "@/features/game/network/game-client";
import { NumberRule } from "@/features/lobby/components/RoomRules";
import {
ArrowRight,
Leaf,
Radio
} from "lucide-react";
import { useEffect,useState } from "react";
export function RoomForm({
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
    [killers, setKillers] = useState(1),
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
    connect({ ...useAppearance.getState().appearance, type: "join", name: playerName, color, hat, code: roomCode });
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
              ...useAppearance.getState().appearance,
              type: "create",
              name: playerName,
              color,
              hat,
              capacity,
              public: publicRoom,
              killers,
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
            <GameSelect
              label="Crew capacity"
              value={capacity}
              options={Array.from({ length: 9 }, (_, i) => ({ value: i + 4, label: `${i + 4} players` }))}
              onChange={(v) => setCapacity(Number(v))}
            />
            <GameSelect
              label="killers"
              value={killers}
              options={[1, 2, 3].map((n) => ({ value: n, label: n === 1 ? "1 killer" : `${n} killers` }))}
              onChange={(v) => setKillers(Number(v))}
            />
            <GameSelect
              label="Elimination cooldown"
              value={cooldown}
              options={[10, 20, 25, 30, 45, 60].map((n) => ({ value: n, label: `${n} seconds` }))}
              onChange={(v) => setCooldown(Number(v))}
            />
            <GameSelect
              label="Discussion time"
              value={discussion}
              options={[10, 25, 45, 60, 90].map((n) => ({ value: n, label: `${n} seconds` }))}
              onChange={(v) => setDiscussion(Number(v))}
            />
          </div>
          <p className="hint">
            killers are capped at one per three other players to keep the
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