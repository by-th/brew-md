import { useEffect } from 'react';
import { useStore } from '../hooks/useStore';

/**
 * One-time hint for the jellyfish scene. Fades after 9s or on the first non-UI
 * click (which sends a glow pulse), and the dismissal persists in saved state.
 */
export function JellyfishHint() {
  const sceneId = useStore((s) => s.state.sceneId);
  const dismissed = useStore((s) => s.state.jellyHintDismissed);
  const dismiss = useStore((s) => s.dismissJellyHint);
  const isJelly = sceneId === 'jellyfish-deep';

  useEffect(() => {
    if (!isJelly || dismissed) return;
    const t = setTimeout(dismiss, 9000);
    const onDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (el && typeof el.closest === 'function' && el.closest('[data-ui]')) return;
      dismiss();
    };
    window.addEventListener('pointerdown', onDown);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [isJelly, dismissed, dismiss]);

  if (!isJelly || dismissed) return null;
  return (
    <div className="koi-hint" aria-hidden="true">
      drag the water to guide the jellyfish
    </div>
  );
}
