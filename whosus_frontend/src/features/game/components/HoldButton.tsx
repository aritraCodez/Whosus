import { useEffect, useRef, type ReactNode } from "react";
export function HoldButton({
  children,
  onClick,
  disabled,
  className,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className: string;
  title?: string;
}) {
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const action = useRef(onClick);
  action.current = onClick;
  const stop = () => {
    clearInterval(timer.current);
    timer.current = undefined;
  };
  useEffect(() => {
    if (disabled) stop();
    return stop;
  }, [disabled]);
  useEffect(() => {
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      stop();
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, []);
  return (
    <button
      className={className}
      title={title}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        stop();
        action.current();
        timer.current = setInterval(() => action.current(), 250);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onClick={(e) => {
        if (e.detail === 0) action.current();
      }}
    >
      {children}
    </button>
  );
}
