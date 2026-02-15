interface ScoreModeSelectorProps {
  disabled?: boolean;
}

export function ScoreModeSelector({ disabled }: ScoreModeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-muted-foreground" htmlFor="score-mode">Score</label>
      <select
        id="score-mode"
        className="px-3 py-1.5 text-sm border rounded-md bg-background disabled:opacity-50"
        disabled={disabled}
        defaultValue="riley"
      >
        <option value="riley">Riley&apos;s In C</option>
        <option value="generative" disabled>Generative (coming soon)</option>
        <option value="euclidean" disabled>Euclidean (coming soon)</option>
      </select>
    </div>
  );
}
