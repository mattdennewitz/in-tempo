interface ScoreModeSelectorProps {
  disabled?: boolean;
}

export function ScoreModeSelector({ disabled }: ScoreModeSelectorProps) {
  return (
    <div className="score-mode-selector">
      <label className="score-mode-label" htmlFor="score-mode">Score</label>
      <select
        id="score-mode"
        className="score-mode-select"
        disabled={disabled}
        defaultValue="riley"
      >
        <option value="riley">Riley's In C</option>
        <option value="generative" disabled>Generative (coming soon)</option>
        <option value="euclidean" disabled>Euclidean (coming soon)</option>
      </select>
    </div>
  );
}
