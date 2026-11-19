import { useEffect, useRef, useState } from 'react';
import { getScene } from '../../data/scenes';
import type { Scene } from '../../scene/types';
import { ParticleSystem } from '../../scene/particles';
import { KoiLayer } from './KoiLayer';
import { JellyfishLayer } from './JellyfishLayer';
import { AstralTeaGardenLayer } from './AstralTeaGardenLayer';
import { ConservatoryLayer } from './ConservatoryLayer';
import { useStore } from '../../hooks/useStore';
import { useReducedMotion } from '../../hooks/useReducedMotion';

function SceneLayers({ scene, prev }: { scene: Scene; prev?: boolean }) {
  return (
    <div className={'scene-stack' + (prev ? ' scene-prev' : '')} aria-hidden="true">
      {scene.layers.map((l, i) => (
        <div
          key={i}
          className={'gl' + (l.animate && l.animate !== 'none' ? ' gl-' + l.animate : '')}
          style={{
            background: l.css,
            mixBlendMode: (l.blend as React.CSSProperties['mixBlendMode']) ?? 'normal',
            opacity: l.opacity ?? 1,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Full-screen background: gradient stacks (current beneath, outgoing crossfading
 * on top) + one canvas particle layer driven imperatively. Honors reduced motion
 * (static draw) and pauses work when the tab is hidden.
 */
export function SceneRenderer() {
  const sceneId = useStore((s) => s.state.sceneId);
  const reduced = useReducedMotion();
  const scene = getScene(sceneId);

  const [prev, setPrev] = useState<Scene | null>(null);
  const prevIdRef = useRef(sceneId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sysRef = useRef<ParticleSystem | null>(null);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  // Crossfade + particle reconfigure on scene change.
  useEffect(() => {
    if (prevIdRef.current === sceneId) return;
    const old = getScene(prevIdRef.current);
    prevIdRef.current = sceneId;
    setPrev(old);
    const sys = sysRef.current;
    if (sys) {
      sys.configure(getScene(sceneId).particles);
      if (reducedRef.current) sys.drawStatic();
    }
    const t = setTimeout(() => setPrev(null), 850);
    return () => clearTimeout(t);
  }, [sceneId]);

  // Particle system + animation loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sys = new ParticleSystem(canvas, getScene(prevIdRef.current).particles);
    sysRef.current = sys;

    const onResize = () => {
      sys.resize();
      if (reducedRef.current) sys.drawStatic();
    };
    window.addEventListener('resize', onResize);

    let raf = 0;
    let last = 0;
    let running = false;
    const loop = (now: number) => {
      if (!running) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      if (!document.hidden) sys.step(dt);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
    };

    if (reducedRef.current) sys.drawStatic();
    else start();

    const onVis = () => {
      if (document.hidden) stop();
      else if (!reducedRef.current) start();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      stop();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      sysRef.current = null;
    };
  }, [reduced]);

  // Custom WebGL renderer (koi pond). Mount while it is the current or the
  // outgoing scene so it can crossfade, then unmount (and destroy) cleanly.
  const showKoi = scene.renderer === 'koi' || prev?.renderer === 'koi';
  const koiActive = scene.renderer === 'koi';
  const showJelly = scene.renderer === 'jellyfish' || prev?.renderer === 'jellyfish';
  const jellyActive = scene.renderer === 'jellyfish';
  const showAstral = scene.renderer === 'astral' || prev?.renderer === 'astral';
  const astralActive = scene.renderer === 'astral';
  const showConservatory = scene.renderer === 'conservatory' || prev?.renderer === 'conservatory';
  const conservatoryActive = scene.renderer === 'conservatory';

  return (
    <div className="scene-root">
      <SceneLayers scene={scene} />
      {showKoi && <KoiLayer key="koi" active={koiActive} reduced={reduced} />}
      {showJelly && <JellyfishLayer key="jelly" active={jellyActive} reduced={reduced} />}
      {showAstral && <AstralTeaGardenLayer key="astral" active={astralActive} reduced={reduced} />}
      {showConservatory && <ConservatoryLayer key="conservatory" active={conservatoryActive} reduced={reduced} />}
      {prev && <SceneLayers scene={prev} prev key={prev.id} />}
      <canvas ref={canvasRef} className="scene-canvas" aria-hidden="true" />
    </div>
  );
}
