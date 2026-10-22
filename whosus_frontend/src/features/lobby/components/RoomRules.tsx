import { GameSelect } from "@/components/ui/GameSelect";
import { useGame } from "@/features/game/model/game-store";
import { act } from "@/features/game/network/game-client";

export function NumberRule({
  label,
  value,
  options,
  onChange,
  disabled = false,
  suffix = "",
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (value: number) => void;
  disabled?: boolean;
  suffix?: string;
}) {
  return (
    <GameSelect
      label={label}
      value={value}
      disabled={disabled}
      options={options.map((n) => ({ value: n, label: `${n}${suffix}` }))}
      onChange={(v) => onChange(Number(v))}
    />
  );
}

export function RoomRules({
  section = "all",
}: {
  section?: "all" | "room" | "meetings";
}) {
  const { room: r, id } = useGame();
  if (!r) return null;
  const disabled = id !== r.host || r.phase !== "lobby";
  const rules = r.rules ?? {
    killCooldown: 25,
    discussion: 25,
    voting: 30,
    emergencyMeetings: 1,
    meetingCooldown: 20,
  };
  const change = (key: string) => (value: number) =>
    act("settings", key, value);
  return (
    <section className="host-rules">
      <p className="muted">
        {id !== r.host
          ? "Only the host can change room rules in the waiting room. You can view them here."
          : r.phase !== "lobby"
            ? "Room rules are locked during a match. Change them in the waiting room."
            : "Changes apply to everyone. Players must ready up again after a rule changes."}
      </p>
      {section !== "meetings" && (
        <GameSelect
          label="Room visibility"
          value={String(r.public)}
          disabled={disabled}
          options={[
            { value: "false", label: "Private · invite code only" },
            { value: "true", label: "Public · listed in Find a room" },
          ]}
          onChange={(v) => act("settings", "public", v === "true")}
        />
      )}
      <div className="form-grid">
        {section !== "meetings" && (
          <>
            <NumberRule
              label="Crew capacity"
              value={r.capacity}
              options={Array.from({ length: 9 }, (_, i) => i + 4).filter(
                (n) => n >= r.population,
              )}
              disabled={disabled}
              onChange={change("capacity")}
            />
            <NumberRule
              label="killers"
              value={r.killers}
              options={[1, 2, 3]}
              disabled={disabled}
              onChange={change("killers")}
            />
            <NumberRule
              label="Movement speed"
              value={r.movementSpeed ?? 1}
              options={[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]}
              suffix="×"
              disabled={disabled}
              onChange={change("movementSpeed")}
            />
            <NumberRule
              label="Kill cooldown"
              value={rules.killCooldown}
              options={[10, 15, 20, 25, 30, 45, 60]}
              suffix=" s"
              disabled={disabled}
              onChange={change("killCooldown")}
            />
          </>
        )}
        {section !== "room" && (
          <>
            <NumberRule
              label="Discussion time"
              value={rules.discussion}
              options={[10, 15, 25, 30, 45, 60, 90]}
              suffix=" s"
              disabled={disabled}
              onChange={change("discussion")}
            />
            <NumberRule
              label="Voting time"
              value={rules.voting}
              options={[10, 15, 30, 45, 60, 90, 120]}
              suffix=" s"
              disabled={disabled}
              onChange={change("voting")}
            />
            <NumberRule
              label="Emergency meetings per player"
              value={rules.emergencyMeetings}
              options={[0, 1, 2, 3]}
              disabled={disabled}
              onChange={change("emergencyMeetings")}
            />
            <NumberRule
              label="Meeting cooldown"
              value={rules.meetingCooldown}
              options={[10, 15, 20, 25, 30, 45, 60]}
              suffix=" s"
              disabled={disabled}
              onChange={change("meetingCooldown")}
            />
          </>
        )}
      </div>
      {section !== "meetings" && (
        <p className="hint">
          At least 4 ready players to launch. Two killers need 7 players; three
          need 10.
        </p>
      )}
    </section>
  );
}
