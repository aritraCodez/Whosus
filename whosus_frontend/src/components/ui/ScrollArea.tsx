import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Keep navigation outside the scrollable content, including on touch screens. */
export function ScrollArea({
  children,
  label,
  className = "",
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ above: false, below: false });

  useEffect(() => {
    const element = viewport.current!;
    const update = () => {
      const above = element.scrollTop > 2;
      const below =
        element.scrollTop + element.clientHeight < element.scrollHeight - 2;
      setEdges((previous) =>
        previous.above === above && previous.below === below
          ? previous
          : { above, below },
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    observer.observe(content.current!);
    element.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, []);

  const move = (direction: number) => {
    const element = viewport.current!;
    element.scrollBy({
      top: direction * element.clientHeight * 0.8,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };

  return (
    <div className={`scroll-area ${className}`}>
      <div
        className="scroll-area-viewport"
        ref={viewport}
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        <div ref={content}>{children}</div>
      </div>
      {(edges.above || edges.below) && (
        <div className="scroll-area-nav">
          <button
            type="button"
            disabled={!edges.above}
            onClick={() => move(-1)}
            aria-label={`Scroll up in ${label}`}
          >
            <ChevronUp size={16} /> Back up
          </button>
          <button
            type="button"
            disabled={!edges.below}
            onClick={() => move(1)}
            aria-label={`Scroll down in ${label}`}
          >
            More below <ChevronDown size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
