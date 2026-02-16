import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExportButtonProps {
  onExport: () => void;
  disabled: boolean;
}

export function ExportButton({ onExport, disabled }: ExportButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onExport}
      disabled={disabled}
      aria-label="Export MIDI file"
    >
      <Download className="size-3.5" />
      Export MIDI
    </Button>
  );
}
