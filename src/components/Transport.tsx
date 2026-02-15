import { Button } from '@/components/ui/button';

interface TransportProps {
  playing: boolean;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}

export function Transport({ playing, onStart, onStop, onReset }: TransportProps) {
  return (
    <div className="flex gap-3">
      <Button
        variant="outline"
        onClick={onStart}
        disabled={playing}
      >
        Start
      </Button>
      <Button
        variant="outline"
        onClick={onStop}
        disabled={!playing}
      >
        Stop
      </Button>
      <Button
        variant="outline"
        onClick={onReset}
        disabled={playing}
      >
        Reset
      </Button>
    </div>
  );
}
