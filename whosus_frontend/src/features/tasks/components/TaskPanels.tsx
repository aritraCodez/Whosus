import { useGame } from "@/features/game/model/game-store";
import { TaskSession } from '@/features/tasks/components/TaskSession';
export function UniversalTaskPanel() {
  const s = useGame();
  const c = s.room?.challenge || s.fakeChallenge;
  if (!c) return null;
  return <TaskSession key={c.nonce} c={c} />;
}