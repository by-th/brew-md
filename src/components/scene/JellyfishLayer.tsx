import { useEffect, useRef } from 'react';
import { JellyfishScene } from '../../scene/jellyfish/JellyfishScene';

/**
 * Mounts the WebGL2 jellyfish scene. The canvas is created imperatively so every
 * init gets a fresh, un-lost context (correct for scene switch-away, which
 * destroys the scene + calls loseContext, and also safe under React StrictMode's
 * mount/unmount/mount). If WebGL2 / the float-buffer extension is unavailable,
 * the canvas is removed so the scene's fallback gradients show.
 */
export function JellyfishLayer({ active, reduced }: { active: boolean; reduced: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<JellyfishScene | null>(null);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'jelly-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    wrap.appendChild(canvas);

    const jelly = new JellyfishScene();
    if (jelly.init(canvas)) {
      jelly.setReduced(reducedRef.current);
      sceneRef.current = jelly;
      jelly.start();
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
    const cv = wrapRef.current?.querySelector('.jelly-canvas');
    if (cv) cv.classList.toggle('jelly-leaving', !active);
  }, [active]);

  return <div ref={wrapRef} className="jelly-wrap" aria-hidden="true" />;
}
