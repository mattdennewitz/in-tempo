import { Button } from '@/components/ui/button';

interface ExportButtonProps {
  onExport: () => void;
  disabled: boolean;
}

export function ExportButton({ onExport, disabled }: ExportButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={onExport}
      disabled={disabled}
      aria-label="Export MIDI file"
    >
      Export MIDI
    </Button>
  );
}
