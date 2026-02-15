import type { PerformerState } from '../audio/types.ts';

interface PatternDisplayProps {
  performers: PerformerState[];
  playing: boolean;
  ensembleComplete: boolean;
  totalPatterns: number;
}

export function PatternDisplay({ performers, playing, ensembleComplete, totalPatterns: _totalPatterns }: PatternDisplayProps) {
  if (ensembleComplete) {
    return (
      <div className="text-center">
        <span className="text-xl font-medium tracking-tight">Performance Complete</span>
      </div>
    );
  }

  if (!playing && performers.length === 0) {
    return (
      <div className="text-center">
        <span className="text-xl font-medium tracking-tight">Ready</span>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="grid grid-cols-4 gap-2 min-w-[280px]">
        {performers.map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-1.5 px-2 py-1 border rounded text-sm tabular-nums transition-opacity duration-300 ${
              p.status === 'playing' ? 'opacity-100' :
              p.status === 'silent' ? 'opacity-40' :
              'opacity-20'
            }`}
          >
            <span className="text-muted-foreground font-medium min-w-[1.8em]">P{p.id + 1}</span>
            <span>
              {p.status === 'complete' ? 'Done' : p.status === 'silent' ? '...' : `${p.currentPattern}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
