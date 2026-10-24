import { GameSelect } from "@/components/ui/GameSelect";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Modal } from "@/components/ui/Modal";
import { useAppearance } from "@/features/appearance/model/appearance-store";
import { connect } from "@/features/game/network/game-client";
import { MAPS, mapInfo, type MapId } from "@/features/game/model/maps";
import {
  fetchPublicRooms,
  type PublicRoomSummary,
} from "@/features/lobby/api/rooms";
import { NumberRule } from "@/features/lobby/components/RoomRules";
import { ArrowLeft, ArrowRight, Radio } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function MapPreview({ mapId }: { mapId: MapId }) {
  const columns = [36, 120, 204];
  const rows = [20, 60, 100];
  return (
    <svg
      className="map-preview"
      data-map={mapId}
      viewBox="0 0 240 120"
      role="img"
      aria-label={`${mapInfo(mapId).name} top-down map preview`}
    >
      <path
        className="map-preview-path"
        d="M63 20h30m54 0h30M63 60h30m54 0h30M63 100h30m54 0h30M36 33v14m0 26v14m84-54v14m0 26v14m84-54v14m0 26v14"
      />
      {mapId === "mosslight" && (
        <path
          className="map-preview-trail"
          d="M35 20c22 0 18 40 43 40s17 40 42 40 20-40 42-40 18-40 42-40"
        />
      )}
      {rows.flatMap((y, row) =>
        columns.map((x, column) => {
          const index = row * 3 + column;
          return (
            <g key={index}>
              <rect
                className={`map-preview-room${index === 4 ? " map-preview-center" : ""}`}
                x={x - 27}
                y={y - 13}
                width="54"
                height="26"
                rx="7"
              />
              {mapId === "mosslight" ? (
                <path
                  className="map-preview-detail"
                  d={`M${x} ${y - 5}l5 5-5 5-5-5z`}
                />
              ) : (
                <circle
                  className="map-preview-detail"
                  cx={x}
                  cy={y}
                  r={index === 4 ? 4 : 2.5}
                />
              )}
            </g>
          );
        }),
      )}
    </svg>
  );
}

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
  const [step, setStep] = useState(0);
  const [mapId, setMapId] = useState<MapId>("cloudline");
  const nameInput = useRef<HTMLInputElement>(null);
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
  const [list, setList] = useState<PublicRoomSummary[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (error && step === 0) nameInput.current?.focus();
  }, [error, step]);
  async function refresh() {
    setLoading(true);
    try {
      setList(await fetchPublicRooms());
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
    connect({
      ...useAppearance.getState().appearance,
      type: "join",
      name: playerName,
      color,
      hat,
      code: roomCode,
    });
    close();
  }
  const nameField = (
    <label>
      YOUR EXPLORER
      <input
        ref={nameInput}
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
      className={mode === "create" ? "room-create-dialog" : ""}
      close={close}
    >
      {mode !== "create" && (
        <p className="muted">
          {mode === "join"
            ? "Enter the six-character code your host shared."
            : "Open expeditions waiting for a little company."}
        </p>
      )}
      {mode === "create" ? (
        <form
          className="room-create-form"
          onSubmit={(e) => {
            e.preventDefault();
            const playerName = name.trim();
            if (!playerName) {
              setStep(0);
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
              map_id: mapId,
            });
            close();
          }}
        >
          <nav
            className="mission-sections room-create-steps"
            aria-label="Room setup steps"
          >
            {["Explorer", "Crew", "Meetings"].map((label, index) => (
              <button
                type="button"
                key={label}
                aria-pressed={step === index}
                onClick={() => setStep(index)}
              >
                {label}
              </button>
            ))}
          </nav>
          <ScrollArea key={step} label="Room setup">
            <div className="room-create-page">
              {step === 0 && (
                <>
                  {nameField}
                  <GameSelect
                    label="Map"
                    value={mapId}
                    options={Object.entries(MAPS).map(([value, info]) => ({
                      value,
                      label: info.name,
                    }))}
                    onChange={(value) => setMapId(value as MapId)}
                  />
                  <div className="map-card" aria-live="polite">
                    <MapPreview mapId={mapId} />
                    <div className="map-card-copy">
                      <small>YOUR DESTINATION</small>
                      <h3>{mapInfo(mapId).name}</h3>
                      <p>{mapInfo(mapId).description}</p>
                    </div>
                    <span className="tag">ORIGINAL</span>
                  </div>

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
                </>
              )}
              {step === 1 && (
                <>
                  <h3>Build your crew</h3>
                  <p className="hint">Set your crew size and pace.</p>
                  <div className="form-grid">
                    <GameSelect
                      label="Crew capacity"
                      value={capacity}
                      options={Array.from({ length: 9 }, (_, i) => ({
                        value: i + 4,
                        label: `${i + 4} players`,
                      }))}
                      onChange={(v) => setCapacity(Number(v))}
                    />
                    <GameSelect
                      label="killers"
                      value={killers}
                      options={[1, 2, 3].map((n) => ({
                        value: n,
                        label: n === 1 ? "1 killer" : `${n} killers`,
                      }))}
                      onChange={(v) => setKillers(Number(v))}
                    />
                    <NumberRule
                      label="Movement speed"
                      value={speed}
                      options={[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]}
                      suffix="×"
                      onChange={setSpeed}
                    />
                    <GameSelect
                      label="Elimination cooldown"
                      value={cooldown}
                      options={[10, 20, 25, 30, 45, 60].map((n) => ({
                        value: n,
                        label: `${n} seconds`,
                      }))}
                      onChange={(v) => setCooldown(Number(v))}
                    />
                  </div>
                  <p className="hint">
                    Killers are capped at one per three other players to keep
                    the match fair.
                  </p>
                </>
              )}
              {step === 2 && (
                <>
                  <h3>Make time for an alibi</h3>
                  <p className="hint">Set discussion and voting limits.</p>
                  <div className="form-grid">
                    <GameSelect
                      label="Discussion time"
                      value={discussion}
                      options={[10, 25, 45, 60, 90].map((n) => ({
                        value: n,
                        label: `${n} seconds`,
                      }))}
                      onChange={(v) => setDiscussion(Number(v))}
                    />
                    <NumberRule
                      label="Voting time"
                      value={voting}
                      options={[10, 15, 30, 45, 60, 90, 120]}
                      suffix=" s"
                      onChange={setVoting}
                    />
                    <NumberRule
                      label="Emergency meetings per player"
                      value={meetings}
                      options={[0, 1, 2, 3]}
                      onChange={setMeetings}
                    />
                    <NumberRule
                      label="Meeting cooldown"
                      value={meetingCooldown}
                      options={[10, 15, 20, 25, 30, 45, 60]}
                      suffix=" s"
                      onChange={setMeetingCooldown}
                    />
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <footer className="room-create-footer">
            <div className="room-create-summary">
              {publicRoom ? "Public" : "Private"} · {capacity} players ·{" "}
              {killers} {killers === 1 ? "killer" : "killers"}
            </div>
            <div className="room-create-actions">
              <button
                type="button"
                className="secondary"
                disabled={step === 0}
                onClick={() => setStep(step - 1)}
                aria-label="Previous setup step"
              >
                <ArrowLeft size={18} />
              </button>
              {step < 2 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setStep(step + 1)}
                >
                  Next <ArrowRight size={16} />
                </button>
              )}
              <button className="primary" type="submit">
                Create room <ArrowRight size={18} />
              </button>
            </div>
          </footer>
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
                  <small>
                    {r.code} · {mapInfo(r.mapId).name}
                  </small>
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
