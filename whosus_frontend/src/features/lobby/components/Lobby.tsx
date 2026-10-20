import { GameSelect } from "@/components/ui/GameSelect";
import { BotIcon } from "@/features/appearance/components/BotIcon";
import { openPractice } from "@/features/game/actions/interactions";
import { useGame } from "@/features/game/model/game-store";
import { COLORS } from "@/features/game/model/types";
import { act } from "@/features/game/network/game-client";
import { fillLobbyWithTestPlayers } from "@/features/lobby/model/test-players";
import { ArrowRight, Check, Copy, Pencil, Plus, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
export function Lobby() {
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
        <span>
          <strong>{r.code}</strong>
          <small>
            {r.population}/{r.capacity} crew · {r.public ? "Public" : "Private"}
          </small>
        </span>
        <button
          className="secondary"
          aria-expanded={crewOpen}
          aria-controls="lobby-crew-panel"
          onClick={() => setCrewOpen(!crewOpen)}
        >
          {crewOpen ? <X size={17} /> : <Users size={17} />}
          {crewOpen ? "Close crew" : "Crew & room"}
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
        <button
          className="secondary full"
          onClick={() => s.set({ settings: true })}
        >
          {host ? "Room settings" : "View room settings"}
        </button>
        <GameSelect
          label="Room visibility"
          value={String(r.public)}
          disabled={!host}
          options={[
            { value: "false", label: "Private" },
            { value: "true", label: "Public" },
          ]}
          onChange={(v) => act("settings", "public", v === "true")}
        />
        <fieldset className="lobby-colors">
          <legend>Your color</legend>
          {COLORS.map((color, index) => {
            const owner = r.players.find(
              (p) => p.color === color && p.id !== s.id,
            );
            return (
              <button
                key={color}
                type="button"
                aria-label={`Color ${index + 1}${owner ? ` · taken by ${owner.name}` : ""}`}
                aria-pressed={me?.color === color}
                title={
                  owner ? `Taken by ${owner.name}` : `Choose color ${index + 1}`
                }
                disabled={!!owner}
                style={{ background: color }}
                onClick={() => act("color", "", index)}
              >
                {owner ? "×" : me?.color === color ? "✓" : ""}
              </button>
            );
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
              {host && p.id !== s.id && (
                <button
                  className="kick-player"
                  aria-label={`Kick ${p.name}`}
                  onClick={() => act("kick", p.id)}
                >
                  Kick
                </button>
              )}
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
        <button className="secondary full" onClick={openPractice}>
          Practice Task at console
        </button>
        {host && (
          <button
            className="secondary full fill-crew"
            disabled={addingTestPlayers}
            onClick={() => void addTestPlayers()}
          >
            {addingTestPlayers
              ? "Adding test players…"
              : r.population < r.capacity
                ? `Fill to ${r.capacity} players`
                : "Ready added players"}
          </button>
        )}
        <div className="lobby-rules-summary">
          <span>
            TASK BAR:{" "}
            <strong>{(r.taskBarMode || "always").toUpperCase()}</strong>
          </span>
          <i>·</i>
          <span>
            VISUAL TASKS:{" "}
            <strong>{(r.visualTasks ?? true) ? "ON" : "OFF"}</strong>
          </span>
        </div>
      </aside>
      <div className="lobby-bottom">
        <span>
          <Users size={16} /> {r.population}/{r.capacity} explorers <i />{" "}
          {r.killers} killer{r.killers > 1 ? "s" : ""}
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
