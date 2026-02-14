interface BpmSliderProps {
  bpm: number;
  onChange: (bpm: number) => void;
  disabled?: boolean;
}

export function BpmSlider({ bpm, onChange, disabled }: BpmSliderProps) {
  return (
    <div className="bpm-slider">
      <label className="bpm-label" htmlFor="bpm-range">Tempo</label>
      <input
        id="bpm-range"
        type="range"
        min={100}
        max={180}
        step={1}
        value={bpm}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
      />
      <span className="bpm-value">{bpm} BPM</span>
    </div>
  );
}
