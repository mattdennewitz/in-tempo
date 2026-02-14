interface TransportProps {
  playing: boolean;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}

export function Transport({ playing, onStart, onStop, onReset }: TransportProps) {
  return (
    <div className="transport">
      <button
        className="transport-btn start-btn"
        onClick={onStart}
        disabled={playing}
      >
        Start
      </button>
      <button
        className="transport-btn"
        onClick={onStop}
        disabled={!playing}
      >
        Stop
      </button>
      <button
        className="transport-btn"
        onClick={onReset}
        disabled={playing}
      >
        Reset
      </button>
    </div>
  );
}
