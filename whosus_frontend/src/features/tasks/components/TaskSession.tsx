import { Modal } from "@/components/ui/Modal";
import { useGame } from "@/features/game/model/game-store";
import type { Challenge } from "@/features/game/model/types";
import { act } from "@/features/game/network/game-client";
import { AsteroidsGame } from "@/features/tasks/components/games/AsteroidsGame";
import { CleanGame } from "@/features/tasks/components/games/CleanGame";
import { CourseGame } from "@/features/tasks/components/games/CourseGame";
import { DialGame } from "@/features/tasks/components/games/DialGame";
import { DivertGame } from "@/features/tasks/components/games/DivertGame";
import { FuelGame } from "@/features/tasks/components/games/FuelGame";
import { KeypadGame } from "@/features/tasks/components/games/KeypadGame";
import { ScanGame } from "@/features/tasks/components/games/ScanGame";
import { SequenceGame } from "@/features/tasks/components/games/SequenceGame";
import { ShieldsGame } from "@/features/tasks/components/games/ShieldsGame";
import { SwipeGame } from "@/features/tasks/components/games/SwipeGame";
import { WiresGame } from "@/features/tasks/components/games/WiresGame";
import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
export function TaskSession({ c }: { c: Challenge }) {
  const set = useGame((state) => state.set);
  const completed = useRef(false);
  useEffect(() => {
    completed.current = false;
    return () => {
      completed.current = true;
    };
  }, []);

  const isFake = !!c.fake;

  const closeTask = useCallback(() => {
    if (isFake || c.practice) set({ fakeChallenge: null });
    else act("task_cancel");
  }, [isFake, c.practice, set]);

  const handleFinish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    if (c.practice) {
      useGame.setState({ fakeChallenge: null });
    } else if (isFake) {
      set({
        fakeChallenge: null,
        fakeDone: { ...useGame.getState().fakeDone, [c.id]: true },
      });
    } else {
      act("task_step", c.nonce);
    }
  }, [isFake, set, c.practice, c.id, c.nonce]);

  return (
    <Modal title={c.name} close={closeTask} wide>
      <div className={`universal-task-console ${isFake ? "fake-task" : ""}`}>
        <div className="task-meta-bar">
          <span className="room-tag">{c.room.toUpperCase()}</span>
          {c.category && (
            <span className={`category-tag ${c.category}`}>
              {c.category.toUpperCase()} TASK
            </span>
          )}
          {c.visual && (
            <span className="visual-tag">
              <Sparkles size={12} /> VISUAL
            </span>
          )}
          {isFake && (
            <span className="fake-alert-tag">FAKE TASK (NO PROGRESS)</span>
          )}
          {c.practice && (
            <span className="visual-tag">PRACTICE · NO MISSION PROGRESS</span>
          )}
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
