interface BpmSliderProps {
  bpm: number;
  onChange: (bpm: number) => void;
  disabled?: boolean;
}

export function BpmSlider({ bpm, onChange, disabled }: BpmSliderProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        id="bpm-range"
        type="range"
        min={100}
        max={180}
        step={1}
        value={bpm}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full accent-foreground"
      />
      <span className="text-sm tabular-nums shrink-0 whitespace-nowrap">{bpm} BPM</span>
    </div>
  );
}
