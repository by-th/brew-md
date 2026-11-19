import { useEffect, useRef, useState } from 'react';
import { AstralTeaGardenScene } from '../../scene/astral/AstralTeaGardenScene';
import { useStore } from '../../hooks/useStore';
import { clamp } from '../../lib/clamp';

/**
 * Mounts the Canvas2D astral tea garden. The canvas is created imperatively so
 * every mount gets a fresh context (correct for scene switch-away and safe under
 * React StrictMode's mount/unmount/mount). Focus state is read from the store
 * READ-ONLY here (never driving the timer) and pushed into the scene so the tea
 * steeps, the moon waxes, and the lanterns fill — diegetically, no on-canvas UI.
 */
export function AstralTeaGardenLayer({ active, reduced }: { active: boolean; reduced: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<AstralTeaGardenScene | null>(null);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const timer = useStore((s) => s.state.timer);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'astral-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    wrap.appendChild(canvas);

    const scene = new AstralTeaGardenScene();
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
    const cv = wrapRef.current?.querySelector('.astral-canvas');
    if (cv) cv.classList.toggle('astral-leaving', !active);
  }, [active]);

  // Tick only while a session is running so progress advances smoothly.
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

  // Diegetic "session complete": a phase flip (pomodoro) or a finished countdown
  // triggers a soft petal/bloom wave. We never call advanceTimer here.
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

  return <div ref={wrapRef} className="astral-wrap" aria-hidden="true" />;
}
