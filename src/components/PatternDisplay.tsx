import type { PerformerState } from '../audio/types.ts';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

const CARD = 'w-[8.5rem] h-8 flex items-center gap-1.5 px-2 border rounded text-sm tabular-nums transition-opacity duration-300';

interface PatternDisplayProps {
  performers: PerformerState[];
  playing: boolean;
  ensembleComplete: boolean;
  totalPatterns: number;
  maxPerformers: number;
  activeCount: number;
}

export function PatternDisplay({
  performers,
  playing,
  ensembleComplete,
  totalPatterns,
  maxPerformers,
  activeCount,
}: PatternDisplayProps) {
  if (ensembleComplete) {
    return (
      <div className="text-center">
        <span className="text-xl font-medium tracking-tight">Performance Complete</span>
      </div>
    );
  }

  // Build slots for all possible performers
  const slots = Array.from({ length: maxPerformers }, (_, i) => {
    const performer = performers.find(p => p.id === i);
    const isActive = playing ? !!performer : i < activeCount;
    return { index: i, performer, isActive };
  });

  if (!playing && performers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4">
        <span className="text-xl font-medium tracking-tight">Ready</span>
        <div className="grid grid-cols-4 gap-2">
          {slots.map(({ index, isActive }) => (
            <div
              key={index}
              className={cn(CARD, isActive ? 'opacity-60' : 'opacity-15')}
            >
              <span className="text-muted-foreground font-medium w-[1.8em] shrink-0">P{index + 1}</span>
              <span className="text-muted-foreground">&mdash;</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="grid grid-cols-4 gap-2">
        {slots.map(({ index, performer, isActive }) => {
          if (!isActive) {
            return (
              <div key={index} className={cn(CARD, 'opacity-15')}>
                <span className="text-muted-foreground font-medium w-[1.8em] shrink-0">P{index + 1}</span>
                <span className="text-muted-foreground">&mdash;</span>
              </div>
            );
          }

          const status = performer?.status ?? 'silent';
          const hitVelocity = performer?.lastHitVelocity ?? 0;
          return (
            <div
              key={index}
              className={cn(
                CARD,
                status === 'playing' ? 'opacity-100 shadow-sm' :
                status === 'silent' ? 'opacity-40' :
                'opacity-20',
              )}
            >
              {status === 'playing' && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0 transition-opacity duration-100"
                  style={{ opacity: hitVelocity }}
                />
              )}
              <span className="text-muted-foreground font-medium w-[1.8em] shrink-0">P{index + 1}</span>
              <span className="truncate text-xs">
                {status === 'complete' ? 'Done' : status === 'silent' ? 'Resting' : `${performer!.currentPattern}/${totalPatterns}`}
              </span>
              {status === 'playing' && performer!.totalReps > 0 && (
                <Progress
                  value={(performer!.currentRep / performer!.totalReps) * 100}
                  className="h-1.5 flex-1 min-w-0 ml-auto"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
