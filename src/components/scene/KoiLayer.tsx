import { useEffect, useRef } from 'react';
import { KoiPondScene } from '../../scene/koi/KoiPondScene';

/**
 * Mounts the WebGL2 koi pond. The canvas is created imperatively so every init
 * gets a fresh, un-lost context (correct for scene switch-away, which destroys
 * the scene + calls loseContext, and also safe under React StrictMode's
 * mount/unmount/mount). If WebGL2 / the float-buffer extension is unavailable,
 * the canvas is removed so the scene's fallback gradients show.
 */
export function KoiLayer({ active, reduced }: { active: boolean; reduced: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<KoiPondScene | null>(null);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'koi-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    wrap.appendChild(canvas);

    const koi = new KoiPondScene();
    if (koi.init(canvas)) {
      koi.setReduced(reducedRef.current);
      sceneRef.current = koi;
      koi.start();
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
    const cv = wrapRef.current?.querySelector('.koi-canvas');
    if (cv) cv.classList.toggle('koi-leaving', !active);
  }, [active]);

  return <div ref={wrapRef} className="koi-wrap" aria-hidden="true" />;
}
