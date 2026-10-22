import { ScrollArea } from "@/components/ui/ScrollArea";
import { BotIcon } from "@/features/appearance/components/BotIcon";
import { useGame } from "@/features/game/model/game-store";
import { act } from "@/features/game/network/game-client";
import { ArrowRight, Radio } from "lucide-react";
import { useEffect, useState } from "react";
export function Meeting() {
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
        <ScrollArea label="Players" className="meeting-players">
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
        </ScrollArea>
        <div className="meeting-bottom">
          <span role="status">
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
