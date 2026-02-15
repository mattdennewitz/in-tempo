import type { PerformerState } from '../audio/types.ts';

interface PatternDisplayProps {
  performers: PerformerState[];
  playing: boolean;
  ensembleComplete: boolean;
  totalPatterns: number;
}

export function PatternDisplay({ performers, playing, ensembleComplete, totalPatterns }: PatternDisplayProps) {
  if (ensembleComplete) {
    return (
      <div className="pattern-display">
        <span className="pattern-text">Performance Complete</span>
      </div>
    );
  }

  if (!playing && performers.length === 0) {
    return (
      <div className="pattern-display">
        <span className="pattern-text">Ready</span>
      </div>
    );
  }

  return (
    <div className="pattern-display">
      <div className="performer-grid">
        {performers.map((p) => (
          <div key={p.id} className={`performer-status performer-status--${p.status}`}>
            <span className="performer-id">P{p.id + 1}</span>
            <span className="performer-pattern">
              {p.status === 'complete' ? 'Done' : p.status === 'silent' ? '...' : `${p.currentPattern}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
