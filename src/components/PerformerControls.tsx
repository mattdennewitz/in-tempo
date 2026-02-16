import type { PerformerState } from '../audio/types.ts';

const MIN_PERFORMERS = 2;
const MAX_PERFORMERS = 16;

interface PerformerControlsProps {
  onCountChange: (count: number) => void;
  performers: PerformerState[];
  disabled: boolean;
  count?: number;
}

export function PerformerControls({
  onCountChange,
  performers,
  disabled,
  count,
}: PerformerControlsProps) {
  const activeCount = count ?? performers.filter(p => p.status !== 'complete').length;

  return (
    <div className="flex items-center gap-3" role="group" aria-label="Performer count">
      <input
        id="performer-count"
        type="range"
        min={MIN_PERFORMERS}
        max={MAX_PERFORMERS}
        step={1}
        value={activeCount}
        onChange={(e) => onCountChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full accent-foreground"
        aria-label="Number of performers"
      />
      <span
        className="text-sm text-muted-foreground shrink-0 whitespace-nowrap tabular-nums"
        aria-live="polite"
        aria-atomic="true"
      >
        {activeCount} / {MAX_PERFORMERS}
      </span>
    </div>
  );
}
