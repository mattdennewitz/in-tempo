import type { PerformerState } from '../audio/types.ts';

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
    // Remove the performer with the highest id that is not 'complete'
    const target = activePerformers.reduce<PerformerState | null>(
      (best, p) => (!best || p.id > best.id ? p : best),
      null,
    );
    if (target) {
      onRemove(target.id);
    }
  };

  return (
    <div className="performer-controls">
      <button
        className="performer-btn performer-btn-remove"
        onClick={handleRemove}
        disabled={!canRemove}
        title="Remove performer"
      >
        -
      </button>
      <span className="performer-count">{activePerformers.length}</span>
      <button
        className="performer-btn performer-btn-add"
        onClick={onAdd}
        disabled={!canAdd}
        title="Add performer"
      >
        +
      </button>
    </div>
  );
}
