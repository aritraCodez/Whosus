import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export interface GameSelectOption<T extends string | number = string | number> {
  value: T;
  label: string;
}

interface GameSelectProps<T extends string | number> {
  id?: string;
  label?: string;
  ariaLabel?: string;
  value: T;
  options: readonly GameSelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Small accent text shown below the label, e.g. "current: 1×" */
  hint?: string;
}

export function GameSelect<const T extends string | number>({
  id: externalId,
  label,
  ariaLabel,
  value,
  options,
  onChange,
  disabled = false,
  hint,
}: GameSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const uid = useId();
  const id = externalId ?? uid;

  const selected = options.find((o) => String(o.value) === String(value));

  // The browser's top layer escapes overflow clipping, including modal dialogs.
  useLayoutEffect(() => {
    if (!open) return;
    const list = listRef.current!;
    const trigger = ref.current!.querySelector("button")!;
    list.showPopover();
    const position = () => {
      const bounds = trigger.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = (viewport?.offsetTop ?? 0) + 8;
      const bottom =
        (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight) - 8;
      const left = (viewport?.offsetLeft ?? 0) + 8;
      const width = Math.min(
        bounds.width,
        (viewport?.width ?? innerWidth) - 16,
      );
      const below = Math.max(0, bottom - bounds.bottom - 6);
      const above = Math.max(0, bounds.top - top - 6);
      const upwards = below < Math.min(list.scrollHeight, 280) && above > below;
      list.style.width = `${width}px`;
      list.style.maxHeight = `${Math.min(280, upwards ? above : below)}px`;
      list.style.left = `${Math.max(left, Math.min(bounds.left, left + (viewport?.width ?? innerWidth) - 16 - width))}px`;
      list.style.top = `${upwards ? bounds.top - list.offsetHeight - 6 : bounds.bottom + 6}px`;
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(trigger);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
    };
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", handler);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((o) => !o);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = options.findIndex((o) => String(o.value) === String(value));
      const next = options[Math.min(idx + 1, options.length - 1)];
      if (next) onChange(next.value);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = options.findIndex((o) => String(o.value) === String(value));
      const prev = options[Math.max(idx - 1, 0)];
      if (prev) onChange(prev.value);
    }
  };

  const pick = (opt: GameSelectOption<T>) => {
    onChange(opt.value);
    setOpen(false);
  };

  return (
    <div className={`gs-wrap ${disabled ? "gs-disabled" : ""}`} ref={ref}>
      {label && (
        <label htmlFor={id} className="gs-label">
          {label}
          {hint && <span className="gs-hint">{hint}</span>}
        </label>
      )}
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-controls={`${id}-options`}
        aria-expanded={open}
        aria-disabled={disabled}
        disabled={disabled}
        className={`gs-trigger ${open ? "gs-open" : ""}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
      >
        <span className="gs-value">{selected?.label ?? "—"}</span>
        <span className={`gs-chevron ${open ? "gs-chevron-up" : ""}`}>
          <ChevronDown size={14} strokeWidth={2.5} />
        </span>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={`${id}-options`}
          role="listbox"
          popover="manual"
          className="gs-dropdown"
          aria-label={label || ariaLabel}
        >
          {options.map((opt) => {
            const isActive = String(opt.value) === String(value);
            return (
              <li
                key={opt.value}
                data-value={opt.value}
                role="option"
                aria-selected={isActive}
                className={`gs-option ${isActive ? "gs-option-active" : ""}`}
                onClick={() => pick(opt)}
              >
                <span className="gs-option-check">
                  {isActive && <Check size={11} strokeWidth={3} />}
                </span>
                <span>{opt.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
