import type { PerformerState, ScoreMode } from '../audio/types.ts';

interface PatternDisplayProps {
  performers: PerformerState[];
  playing: boolean;
  ensembleComplete: boolean;
  totalPatterns: number;
  scoreMode: ScoreMode;
}

const MODE_LABELS: Record<ScoreMode, string> = {
  riley: 'Riley',
  generative: 'Generative',
  euclidean: 'Euclidean',
};

export function PatternDisplay({ performers, playing, ensembleComplete, totalPatterns, scoreMode }: PatternDisplayProps) {
  if (ensembleComplete) {
    return (
      <div className="pattern-display">
        <span className="mode-badge">{MODE_LABELS[scoreMode]}</span>
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
      <span className="mode-badge">{MODE_LABELS[scoreMode]}</span>
      <div className="performer-grid">
        {performers.map((p) => (
          <div key={p.id} className={`performer-status performer-status--${p.status}`}>
            <span className="performer-id">Player {p.id + 1}</span>
            <span className="performer-pattern">
              {p.status === 'complete' ? 'Done' : p.status === 'silent' ? '...' : `${p.currentPattern}`}
            </span>
            <span className="performer-rep">
              {p.status === 'complete' ? '' : p.status === 'silent' ? '' : `${p.currentRep}/${p.totalReps}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
