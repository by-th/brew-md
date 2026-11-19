import { useEffect, useRef, useState } from 'react';
import { ClockworkConservatoryScene } from '../../scene/conservatory/ClockworkConservatoryScene';
import { useStore } from '../../hooks/useStore';
import { clamp } from '../../lib/clamp';

/**
 * Mounts the WebGL2 clockwork conservatory. The canvas is created imperatively so
 * every init gets a fresh, un-lost context (correct for scene switch-away and safe
 * under React StrictMode). If WebGL2 / the float-buffer extension is unavailable,
 * the canvas is removed so the scene's fallback gradients show. Focus state is read
 * READ-ONLY from the store (never driving the timer) and pushed into the scene so
 * the clock turns, flowers open, and the room warms on break — no on-canvas UI.
 */
export function ConservatoryLayer({ active, reduced }: { active: boolean; reduced: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ClockworkConservatoryScene | null>(null);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const timer = useStore((s) => s.state.timer);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'conservatory-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    wrap.appendChild(canvas);

    const scene = new ClockworkConservatoryScene();
    if (scene.init(canvas)) {
      scene.setReduced(reducedRef.current);
      sceneRef.current = scene;
      scene.start();
    } else {
      canvas.remove(); // fallback to gradient
    }

    return () => {
      sceneRef.current?.destroy();
      sceneRef.current = null;
      canvas.remove();
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setReduced(reduced);
  }, [reduced]);

  useEffect(() => {
    const cv = wrapRef.current?.querySelector('.conservatory-canvas');
    if (cv) cv.classList.toggle('conservatory-leaving', !active);
  }, [active]);

  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, [timer.running]);

  const totalMs = (timer.phase === 'work' ? timer.workMin : timer.breakMin) * 60_000;
  let progress = 0;
  if (timer.mode !== 'off') {
    if (timer.running && timer.endsAt != null) progress = clamp(1 - (timer.endsAt - nowMs) / totalMs, 0, 1);
    else if (timer.pausedMs != null) progress = clamp(1 - timer.pausedMs / totalMs, 0, 1);
  }
  const phase: 'work' | 'break' | 'idle' = timer.mode === 'off' ? 'idle' : timer.phase;

  useEffect(() => {
    sceneRef.current?.setFocusProgress(progress);
  }, [progress]);
  useEffect(() => {
    sceneRef.current?.setPhase(phase);
  }, [phase]);

  // Diegetic "session complete": phase flip (pomodoro) or finished countdown.
  const prevPhase = useRef(timer.phase);
  const prevRunning = useRef(timer.running);
  const prevProg = useRef(progress);
  useEffect(() => {
    const phaseChanged = prevPhase.current !== timer.phase;
    const finishedCountdown =
      prevRunning.current && !timer.running && timer.pausedMs == null && prevProg.current > 0.95;
    if ((phaseChanged || finishedCountdown) && sceneRef.current) sceneRef.current.pulseBloom();
    prevPhase.current = timer.phase;
    prevRunning.current = timer.running;
    prevProg.current = progress;
  }, [timer.phase, timer.running, timer.pausedMs, progress]);

  return <div ref={wrapRef} className="conservatory-wrap" aria-hidden="true" />;
}
