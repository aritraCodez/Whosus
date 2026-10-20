import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

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

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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
          className="gs-dropdown"
          aria-label={label}
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
