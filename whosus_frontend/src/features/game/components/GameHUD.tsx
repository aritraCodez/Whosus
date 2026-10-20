import { BotIcon } from '@/features/appearance/components/BotIcon';
import { ChatPanel } from '@/features/chat/components/ChatPanel';
import { eliminate,interact,report } from '@/features/game/actions/game-actions';
import { HoldButton } from '@/features/game/components/HoldButton';
import { Joystick } from '@/features/game/components/Joystick';
import { Meeting } from '@/features/game/components/Meeting';
import { useGame } from "@/features/game/model/game-store";
import {
act,
leave
} from "@/features/game/network/game-client";
import { Lobby } from '@/features/lobby/components/Lobby';
import { ELIMINATION_NAMES } from "@/features/scene/components/EliminationEffect";
import { PracticePanel } from "@/features/tasks/components/PracticePanel";
import { UniversalTaskPanel } from "@/features/tasks/components/TaskPanels";
import { VoiceBar } from '@/features/voice/components/VoiceBar';
import {
ArrowRight,
Check,
ChevronDown,
ChevronUp,
DoorOpen,
Map,
MessageCircle,
Radio,
Settings,
Shield,
Skull,
Sparkles,
Wifi,
Zap
} from "lucide-react";
import { useState } from "react";
export function GameHUD() {
  const s = useGame(),
    r = s.room!,
    me = r.players.find((p) => p.id === s.id);
  const [tasksCollapsed, setTasksCollapsed] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 700,
  );
  if (!me) return null;
  const killer = me.role === "killer";
  const nearbyTarget = r.players.some(
    (p) =>
      p.id !== s.id &&
      p.alive &&
      p.role !== "killer" &&
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
            <button
              type="button"
              className="task-header"
              onClick={() => setTasksCollapsed(!tasksCollapsed)}
              aria-expanded={!tasksCollapsed}
              aria-controls="mission-tasks"
              aria-label={tasksCollapsed ? "Expand tasks" : "Collapse tasks"}
              title={tasksCollapsed ? "Expand tasks" : "Collapse tasks"}
            >
              <span>
                {killer ? "A LITTLE TREACHERY" : "A LITTLE TEAMWORK"}
              </span>
              <span className="task-header-right">
                <strong>{Math.round(r.progress * 100)}%</strong>
                <span className="task-toggle-icon">
                  {tasksCollapsed ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronUp size={14} />
                  )}
                </span>
              </span>
            </button>
            {!tasksCollapsed && (
              <>
                <div className="progress">
                  <i style={{ width: `${r.progress * 100}%` }} />
                </div>
                <div className="task-content" id="mission-tasks" role="region" aria-label="Mission tasks" tabIndex={0}>
                <h3>
                  {!me.alive
                    ? "Your shift isn’t over."
                    : killer
                      ? "Make yourself believable."
                      : "Keep the station alive."}
                </h3>
                {!me.alive && (
                  <p className="ghost-note">
                    You’re a ghost.{" "}
                    {killer
                      ? "Watch the mystery unfold."
                      : "Finish your tasks and help your crew."}
                  </p>
                )}
                {killer ? (
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
                </div>
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
              {killer && me.alive && (
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
        <div className={`role-reveal ${killer ? "traitor" : ""}`}>
          <span className="eyebrow">KEEP THIS BETWEEN US.</span>
          <BotIcon color={me.color} />
          <h2>You’re {killer ? "the killer." : "a crewmate."}</h2>
          <p>
            {killer
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
                : "The killers got the better of this crew."}
            </p>
            <h3>
              {(killer ? "killer" : "crew") === r.winner
                ? "VICTORY"
                : "BETTER LUCK NEXT EXPEDITION"}
            </h3>
            <div className="reveal-crew">
              {r.players.map((p) => (
                <div key={p.id}>
                  <BotIcon small color={p.color} />
                  <strong>{p.name}</strong>
                  <small className={p.role === "killer" ? "error-text" : ""}>
                    {p.role === "killer" ? "killer" : "Crewmate"}
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
