import { useRef } from 'react';
import { useTimer } from '../../hooks/useTimer';
import { useStore } from '../../hooks/useStore';
import { useDragTap } from '../../hooks/useDragTap';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { Motion } from '../Motion';

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Faint readout, shown whenever a timer mode is active. Tap to start/pause, drag
 * to reposition. Lives outside the chrome so it stays (dimmed) in focus mode.
 */
export function TimerReadout() {
  const ref = useRef<HTMLDivElement>(null);
  const { mode, phase, remaining, pulse } = useTimer();
  const running = useStore((s) => s.state.timer.running);
  const start = useStore((s) => s.startTimer);
  const pause = useStore((s) => s.pauseTimer);
  const pos = useStore((s) => s.state.timerPos);
  const setPos = useStore((s) => s.setTimerPos);

  const mobile = useIsMobile();
  const startDrag = useDragTap(ref, setPos, () => (running ? pause() : start()), mobile);

  if (mode === 'off') return null;
  // On mobile, ignore any desktop-saved position and keep the centered default.
  const style = pos && !mobile ? { left: pos.x, top: pos.y, transform: 'none' } : undefined;

  return (
    <div
      ref={ref}
      className="timer-readout"
      style={style}
      key={pulse}
      onPointerDown={startDrag}
      title={running ? 'tap to pause · drag to move' : 'tap to start · drag to move'}
    >
      <span className="timer-phase">{phase === 'work' ? 'focus' : 'break'}</span>
      <Motion className="timer-time" text={fmt(remaining)} />
    </div>
  );
}
