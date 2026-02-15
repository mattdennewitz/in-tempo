interface HumanizationToggleProps {
  enabled: boolean;
  intensity: 'subtle' | 'moderate' | 'expressive';
  onToggle: () => void;
  onIntensityChange: (intensity: 'subtle' | 'moderate' | 'expressive') => void;
}

const INTENSITY_OPTIONS: { value: HumanizationToggleProps['intensity']; label: string }[] = [
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
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        className={[
          'px-3 py-1.5 text-sm rounded-md border transition-colors duration-150',
          enabled
            ? 'bg-foreground text-background border-foreground'
            : 'bg-background text-muted-foreground border-border hover:border-foreground/30',
        ].join(' ')}
      >
        Humanize: {enabled ? 'On' : 'Off'}
      </button>

      {enabled && (
        <div className="flex gap-1">
          {INTENSITY_OPTIONS.map(({ value, label }) => {
            const isActive = intensity === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={isActive}
                onClick={() => onIntensityChange(value)}
                className={[
                  'px-2.5 py-1 text-xs rounded-md border transition-colors duration-150',
                  isActive
                    ? 'bg-accent border-foreground/40 text-foreground font-semibold'
                    : 'bg-background border-border text-muted-foreground hover:border-foreground/30',
                ].join(' ')}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
