import type { PerformerState } from '../audio/types.ts';
import { Button } from '@/components/ui/button';

const MIN_PERFORMERS = 2;
const MAX_PERFORMERS = 16;

interface PerformerControlsProps {
  onAdd: () => void;
  onRemove: (id: number) => void;
  performers: PerformerState[];
  disabled: boolean;
}

export function PerformerControls({
  onAdd,
  onRemove,
  performers,
  disabled,
}: PerformerControlsProps) {
  const activePerformers = performers.filter(p => p.status !== 'complete');
  const canAdd = !disabled && activePerformers.length < MAX_PERFORMERS;
  const canRemove = !disabled && activePerformers.length > MIN_PERFORMERS;

  const handleRemove = () => {
    const target = activePerformers.reduce<PerformerState | null>(
      (best, p) => (!best || p.id > best.id ? p : best),
      null,
    );
    if (target) {
      onRemove(target.id);
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
        {activePerformers.length}
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
