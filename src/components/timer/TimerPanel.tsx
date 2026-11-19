import { Panel } from '../panels/Panel';
import { Icon } from '../icons';
import { useStore } from '../../hooks/useStore';
import type { TimerMode } from '../../lib/state';

const MODES: { v: TimerMode; l: string }[] = [
  { v: 'off', l: 'off' },
  { v: 'pomodoro', l: 'pomodoro' },
  { v: 'countdown', l: 'countdown' },
];

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="stepper">
      <button className="step-btn" onClick={() => onChange(Math.max(min, value - 1))} aria-label="decrease">
        –
      </button>
      <span className="step-val">{value}</span>
      <button className="step-btn" onClick={() => onChange(Math.min(max, value + 1))} aria-label="increase">
        +
      </button>
    </div>
  );
}

export function TimerPanel({ onClose }: { onClose: () => void }) {
  const timer = useStore((s) => s.state.timer);
  const setConfig = useStore((s) => s.setTimerConfig);
  const start = useStore((s) => s.startTimer);
  const pause = useStore((s) => s.pauseTimer);
  const stop = useStore((s) => s.stopTimer);

  return (
    <Panel title="timer" icon={Icon.timer} side="right" onClose={onClose}>
      <div className="label">mode</div>
      <div className="pills">
        {MODES.map((m) => (
          <button
            key={m.v}
            className={'pill' + (timer.mode === m.v ? ' sel' : '')}
            onClick={() => setConfig({ mode: m.v })}
            aria-pressed={timer.mode === m.v}
          >
            {m.l}
          </button>
        ))}
      </div>

      {timer.mode !== 'off' && (
        <>
          <div className="label">{timer.mode === 'pomodoro' ? 'focus minutes' : 'minutes'}</div>
          <Stepper value={timer.workMin} min={1} max={180} onChange={(v) => setConfig({ workMin: v })} />
          {timer.mode === 'pomodoro' && (
            <>
              <div className="label">break minutes</div>
              <Stepper value={timer.breakMin} min={1} max={60} onChange={(v) => setConfig({ breakMin: v })} />
            </>
          )}
          <div className="timer-actions">
            {timer.running ? (
              <button className="btn" onClick={pause}>
                pause
              </button>
            ) : (
              <button className="btn btn-accent" onClick={start}>
                {timer.pausedMs != null ? 'resume' : 'start'}
              </button>
            )}
            <button className="btn" onClick={stop}>
              reset
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}
