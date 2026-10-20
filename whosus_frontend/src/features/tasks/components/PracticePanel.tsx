import { Modal } from "@/components/ui/Modal";
import { useGame } from "@/features/game/model/game-store";
import { STATIONS } from "@/features/game/model/world";
export function PracticePanel() {
  const s = useGame();
  return (
    <Modal
      title="Practice station"
      close={() => s.set({ practiceOpen: false })}
      wide
    >
      <p className="muted">
        Try any console before launch. Practice does not count toward the
        mission.
      </p>
      <div className="practice-grid">
        {STATIONS.map((t) => (
          <button
            key={t.id}
            className="secondary"
            onClick={() =>
              s.set({
                fakeChallenge: {
                  ...t,
                  done: false,
                  nonce: `practice_${Date.now()}`,
                  sequence: [2, 0, 3, 1],
                  step: 0,
                  started: Date.now() / 1000,
                  practice: true,
                },
              })
            }
          >
            <strong>{t.name}</strong>
            <small>
              {t.room} · {t.category}
            </small>
          </button>
        ))}
      </div>
    </Modal>
  );
}
