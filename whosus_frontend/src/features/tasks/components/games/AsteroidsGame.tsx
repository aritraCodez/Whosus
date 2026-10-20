import { playTaskSound } from '@/features/tasks/audio/task-sounds';
import {
Crosshair
} from "lucide-react";
import { useRef,useState } from "react";
export function AsteroidsGame({ finish }: { finish: () => void }) {
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