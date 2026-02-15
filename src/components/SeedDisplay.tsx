import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface SeedDisplayProps {
  seed: number;           // Current seed (0 = not yet generated)
  playing: boolean;       // Whether performance is active
  onSeedChange: (seed: number) => void;  // User enters a seed
}

export function SeedDisplay({ seed, playing, onSeedChange }: SeedDisplayProps) {
  const [inputValue, setInputValue] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const showFeedback = useCallback((message: string) => {
    setCopyFeedback(message);
    setTimeout(() => setCopyFeedback(null), 1500);
  }, []);

  const handleCopySeed = useCallback(() => {
    if (seed === 0) return;
    navigator.clipboard.writeText(seed.toString());
    showFeedback('Copied!');
  }, [seed, showFeedback]);

  const handleCopyLink = useCallback(() => {
    if (seed === 0) return;
    const url = window.location.href.split('#')[0] + '#' + window.location.hash.slice(1);
    navigator.clipboard.writeText(url);
    showFeedback('Link copied!');
  }, [seed, showFeedback]);

  const handleSubmit = useCallback(() => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      onSeedChange(parsed);
      setInputValue('');
    }
  }, [inputValue, onSeedChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Seed:</span>
        {seed > 0 ? (
          <span className="font-mono text-sm tabular-nums">{seed}</span>
        ) : (
          <span className="text-sm text-muted-foreground italic">random</span>
        )}
        {copyFeedback && (
          <span className="text-xs text-green-600 dark:text-green-400">{copyFeedback}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="xs"
          onClick={handleCopySeed}
          disabled={seed === 0}
          aria-label="Copy seed to clipboard"
        >
          Copy
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={handleCopyLink}
          disabled={seed === 0}
          aria-label="Copy shareable link to clipboard"
        >
          Share
        </Button>
      </div>

      {!playing && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Enter seed..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={handleKeyDown}
            className="h-6 w-28 rounded-md border bg-background px-2 text-xs font-mono shadow-xs focus:outline-none focus:ring-2 focus:ring-ring/50"
            aria-label="Enter seed for replay"
          />
        </div>
      )}
    </div>
  );
}
