interface HumanizationToggleProps {
  enabled: boolean;
  intensity: 'subtle' | 'moderate' | 'expressive';
  onToggle: () => void;
  onIntensityChange: (intensity: 'subtle' | 'moderate' | 'expressive') => void;
}

type Intensity = HumanizationToggleProps['intensity'];

const OPTIONS: { value: 'off' | Intensity; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'subtle', label: 'Subtle' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'expressive', label: 'Expressive' },
];

export function HumanizationToggle({
  enabled,
  intensity,
  onToggle,
  onIntensityChange,
}: HumanizationToggleProps) {
  const current = enabled ? intensity : 'off';

  const handleChange = (value: string) => {
    if (value === 'off') {
      if (enabled) onToggle();
    } else {
      if (!enabled) onToggle();
      onIntensityChange(value as Intensity);
    }
  };

  return (
    <select
      value={current}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Humanization"
      className="h-8 rounded-md border bg-background px-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring/50"
    >
      {OPTIONS.map(({ value, label }) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}
