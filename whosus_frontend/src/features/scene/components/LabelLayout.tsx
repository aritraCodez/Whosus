import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

type Bounds = { left: number; top: number; right: number; bottom: number };
const overlaps = (a: Bounds, b: Bounds) =>
  a.left < b.right + 5 &&
  a.right > b.left - 5 &&
  a.top < b.bottom + 5 &&
  a.bottom > b.top - 5;

/** Resolve projected labels in screen pixels, independently of camera zoom. */
export function LabelLayout() {
  const shifts = useRef(new WeakMap<HTMLElement, { x: number; y: number }>());
  useFrame(({ gl }) => {
    const root = gl.domElement.closest(".scene-wrap");
    if (!root) return;
    const occupied: Bounds[] = Array.from(
      (root.closest(".app") || root).querySelectorAll<HTMLElement>(
        ".station-label, .game-top, .game-bottom, .task-list, .action-buttons, .joystick, .chat-panel",
      ),
    )
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => element.getBoundingClientRect());
    const labels = Array.from(
      root.querySelectorAll<HTMLElement>(".nameplate"),
    ).sort(
      (a, b) =>
        Number(b.classList.contains("you")) -
          Number(a.classList.contains("you")) ||
        a.textContent!.localeCompare(b.textContent!),
    );
    // Read all rectangles before writing styles to avoid repeated layout work.
    const measurements = labels.map((element) => {
      const rect = element.getBoundingClientRect();
      const shift = shifts.current.get(element) || { x: 0, y: 0 };
      return {
        element,
        left: rect.left - shift.x,
        top: rect.top - shift.y,
        width: rect.width,
        height: rect.height,
      };
    });
    for (const { element, left, top, width, height } of measurements) {
      let offset = { x: 0, y: 0 };
      if (
        left + width > 0 &&
        left < innerWidth &&
        top + height > 0 &&
        top < innerHeight
      ) {
        const candidates = [{ x: 0, y: 0 }];
        for (let row = 1; row <= labels.length + 3; row++) {
          candidates.push(
            { x: 0, y: -row * (height + 6) },
            { x: 0, y: row * (height + 6) },
          );
        }
        for (const x of [-(width + 8), width + 8]) {
          for (let row = 0; row <= labels.length; row++) {
            candidates.push(
              { x, y: -row * (height + 6) },
              { x, y: row * (height + 6) },
            );
          }
        }
        for (const candidate of candidates) {
          const bounds = {
            left: left + candidate.x,
            top: top + candidate.y,
            right: left + candidate.x + width,
            bottom: top + candidate.y + height,
          };
          if (
            bounds.left < 8 ||
            bounds.right > innerWidth - 8 ||
            bounds.top < 8 ||
            bounds.bottom > innerHeight - 8
          )
            continue;
          if (occupied.some((other) => overlaps(bounds, other))) continue;
          offset = candidate;
          break;
        }
        occupied.push({
          left: left + offset.x,
          top: top + offset.y,
          right: left + offset.x + width,
          bottom: top + offset.y + height,
        });
      }
      const previous = shifts.current.get(element);
      if (!previous || previous.x !== offset.x || previous.y !== offset.y) {
        element.style.translate = `${offset.x}px ${offset.y}px`;
        shifts.current.set(element, offset);
      }
    }
  });
  return null;
}
