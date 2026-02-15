interface BpmSliderProps {
  bpm: number;
  onChange: (bpm: number) => void;
  disabled?: boolean;
}

export function BpmSlider({ bpm, onChange, disabled }: BpmSliderProps) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-muted-foreground" htmlFor="bpm-range">Tempo</label>
      <input
        id="bpm-range"
        type="range"
        min={100}
        max={180}
        step={1}
        value={bpm}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-64 accent-foreground"
      />
      <span className="text-sm tabular-nums min-w-[5rem]">{bpm} BPM</span>
    </div>
  );
}
