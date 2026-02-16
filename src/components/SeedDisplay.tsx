import { useState, useCallback } from 'react';
import { Copy, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SeedDisplayProps {
  seed: number;
  playing: boolean;
  onSeedChange: (seed: number) => void;
  mode: string;
  bpm: number;
  performerCount: number;
}

export function SeedDisplay({ seed, playing, onSeedChange, mode, bpm, performerCount }: SeedDisplayProps) {
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
    const params = new URLSearchParams({
      seed: seed.toString(),
      mode,
      bpm: bpm.toString(),
      count: performerCount.toString(),
    });
    const url = window.location.href.split('#')[0] + '#' + params.toString();
    navigator.clipboard.writeText(url);
    showFeedback('Link copied!');
  }, [seed, mode, bpm, performerCount, showFeedback]);

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
    <div className="space-y-2">
      {/* Current seed + actions */}
      <div className="flex items-center gap-2">
        <span className="text-sm tabular-nums font-mono min-w-0 truncate">
          {seed > 0 ? seed : <span className="text-muted-foreground italic font-sans">random</span>}
        </span>
        {copyFeedback && (
          <span className="text-xs text-green-600 dark:text-green-400 shrink-0">{copyFeedback}</span>
        )}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopySeed}
            disabled={seed === 0}
            aria-label="Copy seed to clipboard"
          >
            <Copy className="size-3.5" />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            disabled={seed === 0}
            aria-label="Copy shareable link to clipboard"
          >
            <Link className="size-3.5" />
            Share
          </Button>
        </div>
      </div>

      {/* Seed input (pre-playback only) */}
      {!playing && (
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Paste a seed to replay..."
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          className="h-8 w-full rounded-md border bg-background px-3 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring/50"
          aria-label="Enter seed for replay"
        />
      )}
    </div>
  );
}
