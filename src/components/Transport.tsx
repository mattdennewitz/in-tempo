import { Play, Square, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TransportProps {
  playing: boolean;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}

const groupItem =
  'rounded-none shadow-none border-l-0 first:rounded-l-md first:border-l last:rounded-r-md focus:z-10';

const kbd = 'ml-1 text-[10px] text-muted-foreground/60 font-sans font-normal';

export function Transport({ playing, onStart, onStop, onReset }: TransportProps) {
  return (
    <div className="inline-flex items-center" role="group" aria-label="Transport controls">
      <Button
        variant="outline"
        size="sm"
        onClick={playing ? onStop : onStart}
        className={cn(groupItem)}
        title={playing ? 'Stop (Space)' : 'Start (Space)'}
      >
        {playing ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
        {playing ? 'Stop' : 'Start'}
        <kbd className={kbd}>Space</kbd>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onReset}
        disabled={playing}
        className={cn(groupItem)}
        title="Reset (Esc)"
      >
        <RotateCcw className="size-3.5" />
        Reset
        <kbd className={kbd}>Esc</kbd>
      </Button>
    </div>
  );
}
