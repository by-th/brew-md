import { useEffect } from 'react';
import { useStore } from '../hooks/useStore';

/**
 * One-time hint for the koi pond. Fades after 9s or on the first water click,
 * and the dismissal persists in the saved state.
 */
export function KoiHint() {
  const sceneId = useStore((s) => s.state.sceneId);
  const dismissed = useStore((s) => s.state.koiHintDismissed);
  const dismiss = useStore((s) => s.dismissKoiHint);
  const isKoi = sceneId === 'koi-pond';

  useEffect(() => {
    if (!isKoi || dismissed) return;
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
  }, [isKoi, dismissed, dismiss]);

  if (!isKoi || dismissed) return null;
  return (
    <div className="koi-hint" aria-hidden="true">
      click the water to feed the fish
    </div>
  );
}
