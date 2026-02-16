import React, { useEffect, useRef, useMemo } from 'react';
import type { PerformerState, ScoreMode } from '../audio/types.ts';

interface ScoreOverviewProps {
  performers: PerformerState[];
  totalPatterns: number;
  scoreMode: ScoreMode;
  playing: boolean;
}

function ScoreOverviewInner({ performers, totalPatterns, scoreMode, playing }: ScoreOverviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLeadingCol = useRef(0);

  // Determine column count based on mode
  const columnCount = useMemo(() => {
    if (scoreMode === 'riley') {
      return totalPatterns; // Always show all 53 columns
    }
    // Euclidean/Generative: grow progressively
    if (performers.length === 0) return 5;
    const maxPattern = Math.max(...performers.map(p => p.currentPattern), 1);
    return Math.max(maxPattern, 5);
  }, [scoreMode, totalPatterns, performers]);

  // Find leading column for auto-scroll
  const leadingCol = useMemo(() => {
    if (performers.length === 0) return 0;
    return Math.max(...performers.map(p => p.currentPattern));
  }, [performers]);

  // Auto-scroll to keep leading performer visible
  useEffect(() => {
    if (!playing) return;
    if (leadingCol === prevLeadingCol.current) return;
    prevLeadingCol.current = leadingCol;

    const container = scrollRef.current;
    if (!container) return;
    const targetCell = container.querySelector(`[data-col="${leadingCol}"]`);
    if (targetCell) {
      targetCell.scrollIntoView({ behavior: 'smooth', inline: 'end', block: 'nearest' });
    }
  }, [leadingCol, playing]);

  // Column header markers (every 10th column)
  const headerMarkers = useMemo(() => {
    const markers: number[] = [];
    for (let i = 10; i <= columnCount; i += 10) {
      markers.push(i);
    }
    return markers;
  }, [columnCount]);

  return (
    <div className="w-full max-w-4xl mx-auto mt-4">
      <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden border border-border rounded-md p-2">
        <div
          className="inline-grid gap-px"
          style={{
            gridTemplateColumns: `auto repeat(${columnCount}, minmax(0, 1fr))`,
          }}
        >
          {/* Header row */}
          <div /> {/* Empty cell for row label column */}
          {Array.from({ length: columnCount }, (_, i) => {
            const colNum = i + 1;
            const showLabel = headerMarkers.includes(colNum);
            return (
              <div
                key={`h-${i}`}
                className="flex items-end justify-center h-3"
              >
                {showLabel && (
                  <span className="text-[9px] text-muted-foreground leading-none">{colNum}</span>
                )}
              </div>
            );
          })}

          {/* Performer rows */}
          {performers.map((performer) => (
            <React.Fragment key={performer.id}>
              {/* Row label */}
              <div className="flex items-center pr-1.5">
                <span className="text-[10px] text-muted-foreground leading-none whitespace-nowrap">
                  P{performer.id + 1}
                </span>
              </div>
              {/* Cells */}
              {Array.from({ length: columnCount }, (_, i) => {
                const colNum = i + 1;
                const isActive = performer.currentPattern === colNum;
                return (
                  <div
                    key={`${performer.id}-${i}`}
                    data-col={colNum}
                    className={`w-2.5 h-2.5 rounded-sm transition-colors duration-150 ${
                      isActive ? 'bg-foreground' : 'bg-muted'
                    }`}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export const ScoreOverview = React.memo(ScoreOverviewInner);
