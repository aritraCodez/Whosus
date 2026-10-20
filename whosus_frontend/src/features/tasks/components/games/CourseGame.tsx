import { playTaskSound } from "@/features/tasks/audio/task-sounds";
import { Compass } from "lucide-react";
import { useState } from "react";
export function CourseGame({ finish }: { finish: () => void }) {
  const [step, setStep] = useState(0);
  const waypoints = [
    { x: 15, y: 70, label: "Point Alpha" },
    { x: 40, y: 30, label: "Point Beta" },
    { x: 70, y: 60, label: "Point Gamma" },
    { x: 88, y: 25, label: "Cloudline Dock" },
  ];

  const clickWaypoint = (idx: number) => {
    if (idx !== step) return;
    playTaskSound("beep");
    const next = step + 1;
    setStep(next);

    if (next >= waypoints.length) {
      playTaskSound("success");
      setTimeout(finish, 800);
    }
  };

  return (
    <div className="task-game course-game">
      <div className="task-instructions">
        <h3>Plot orbital trajectory</h3>
        <p>
          Confirm the navigational path through each coordinate in sequence.
        </p>
      </div>

      <div className="course-chart">
        <svg
          className="course-lines"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {waypoints.slice(0, step).map((wp, i) => {
            if (i === 0) return null;
            const prev = waypoints[i - 1];
            return (
              <line
                key={i}
                x1={prev.x}
                y1={prev.y}
                x2={wp.x}
                y2={wp.y}
                stroke="#6ad9c5"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
            );
          })}
        </svg>

        {waypoints.map((wp, idx) => {
          const isDone = idx < step;
          const isCurrent = idx === step;
          return (
            <button
              key={idx}
              className={`waypoint-node ${isDone ? "done" : ""} ${isCurrent ? "current pulse" : ""}`}
              style={{ left: `${wp.x}%`, top: `${wp.y}%` }}
              disabled={!isCurrent}
              onClick={() => clickWaypoint(idx)}
            >
              <Compass size={18} />
              <span className="wp-badge">{idx + 1}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
