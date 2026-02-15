import { useState, useRef, useEffect } from 'react';
import type { ScoreMode } from '../audio/types.ts';

interface ScoreModeSelectorProps {
  currentMode: ScoreMode;
  onChange: (mode: ScoreMode) => void;
  disabled?: boolean;
}

const MODE_OPTIONS: { mode: ScoreMode; name: string; description: string }[] = [
  {
    mode: 'riley',
    name: 'Riley',
    description: "Terry Riley's 53 original patterns from In C (1964)",
  },
  {
    mode: 'generative',
    name: 'Generative',
    description: 'Algorithmically generated melodic cells inspired by minimalism',
  },
  {
    mode: 'euclidean',
    name: 'Euclidean',
    description: "Rhythmic patterns via Bjorklund's Euclidean algorithm",
  },
];

export function ScoreModeSelector({ currentMode, onChange, disabled }: ScoreModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = MODE_OPTIONS.find(o => o.mode === currentMode)!;

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative w-72">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={[
          'flex items-center justify-between w-full px-4 py-2.5',
          'border rounded-lg bg-background text-left',
          'transition-colors duration-150',
          disabled
            ? 'opacity-50 cursor-default'
            : 'hover:border-foreground/30 cursor-pointer',
          open ? 'border-foreground/40 ring-2 ring-ring/20' : 'border-border',
        ].join(' ')}
      >
        <span className="text-sm font-semibold text-foreground truncate">
          {selected.name}
        </span>
        <svg
          className={[
            'ml-3 size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open ? 'rotate-180' : '',
          ].join(' ')}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-activedescendant={`mode-${currentMode}`}
          className={[
            'absolute z-50 mt-1.5 w-full',
            'border border-border rounded-lg bg-popover shadow-lg',
            'py-1 overflow-hidden',
            'animate-in fade-in-0 zoom-in-95 duration-150',
          ].join(' ')}
        >
          {MODE_OPTIONS.map(({ mode, name, description }) => {
            const isSelected = mode === currentMode;
            return (
              <li
                key={mode}
                id={`mode-${mode}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(mode);
                  setOpen(false);
                }}
                className={[
                  'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors duration-100',
                  isSelected
                    ? 'bg-accent'
                    : 'hover:bg-accent/60',
                ].join(' ')}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-semibold text-foreground">
                    {name}
                  </span>
                  <span className="text-xs text-muted-foreground leading-snug">
                    {description}
                  </span>
                </div>
                {isSelected && (
                  <svg
                    className="ml-auto mt-0.5 size-4 shrink-0 text-foreground"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
