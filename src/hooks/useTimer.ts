import { useEffect, useRef, useState } from 'react';
import { useStore } from './useStore';
import { audioEngine } from '../audio/engine';

export type TimerView = {
  mode: 'pomodoro' | 'countdown' | 'off';
  running: boolean;
  phase: 'work' | 'break';
  remaining: number; // seconds
  pulse: number; // increments on phase-end (drives the visual pulse + chime)
};

/** Drives the focus timer: ticks, resumes after reload, signals end-of-phase. */
export function useTimer(): TimerView {
  const timer = useStore((s) => s.state.timer);
  const advance = useStore((s) => s.advanceTimer);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pulse, setPulse] = useState(0);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!timer.running) return;
    const t = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(t);
  }, [timer.running]);

  // New phase / fresh start clears the one-shot end guard.
  useEffect(() => {
    firedRef.current = false;
  }, [timer.endsAt, timer.phase]);

  let remaining: number;
  if (timer.running && timer.endsAt != null) {
    remaining = Math.max(0, Math.round((timer.endsAt - nowMs) / 1000));
  } else if (timer.pausedMs != null) {
    remaining = Math.round(timer.pausedMs / 1000);
  } else {
    remaining = (timer.phase === 'work' ? timer.workMin : timer.breakMin) * 60;
  }

  useEffect(() => {
    if (timer.running && timer.endsAt != null && nowMs >= timer.endsAt && !firedRef.current) {
      firedRef.current = true;
      audioEngine.chime();
      setPulse((p) => p + 1);
      advance();
    }
  }, [nowMs, timer.running, timer.endsAt, advance]);

  return { mode: timer.mode, running: timer.running, phase: timer.phase, remaining, pulse };
}
