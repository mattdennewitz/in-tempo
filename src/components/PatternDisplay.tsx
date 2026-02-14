interface PatternDisplayProps {
  currentPattern: number;
  totalPatterns: number;
  playing: boolean;
}

export function PatternDisplay({ currentPattern, totalPatterns, playing }: PatternDisplayProps) {
  let text: string;

  if (!playing && currentPattern >= totalPatterns) {
    text = 'Performance Complete';
  } else {
    text = `Pattern ${currentPattern} of ${totalPatterns}`;
  }

  return (
    <div className="pattern-display">
      <span className="pattern-text">{text}</span>
    </div>
  );
}
