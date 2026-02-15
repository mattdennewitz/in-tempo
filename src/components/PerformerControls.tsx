import type { PerformerState } from '../audio/types.ts';
import { Button } from '@/components/ui/button';

const MIN_PERFORMERS = 2;
const MAX_PERFORMERS = 16;

interface PerformerControlsProps {
  onAdd: () => void;
  onRemove: (id: number) => void;
  performers: PerformerState[];
  disabled: boolean;
  count?: number;
}

export function PerformerControls({
  onAdd,
  onRemove,
  performers,
  disabled,
  count,
}: PerformerControlsProps) {
  const activeCount = count ?? performers.filter(p => p.status !== 'complete').length;
  const canAdd = !disabled && activeCount < MAX_PERFORMERS;
  const canRemove = !disabled && activeCount > MIN_PERFORMERS;

  const handleRemove = () => {
    if (count !== undefined) {
      // Pre-playback mode: just decrement, id doesn't matter
      onRemove(0);
    } else {
      const activePerformers = performers.filter(p => p.status !== 'complete');
      const target = activePerformers.reduce<PerformerState | null>(
        (best, p) => (!best || p.id > best.id ? p : best),
        null,
      );
      if (target) {
        onRemove(target.id);
      }
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon-sm"
        onClick={handleRemove}
        disabled={!canRemove}
      >
        -
      </Button>
      <span className="text-sm text-muted-foreground min-w-[1.5rem] text-center tabular-nums">
        {activeCount}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={onAdd}
        disabled={!canAdd}
      >
        +
      </Button>
    </div>
  );
}
