import { useEffect } from 'react';
import { useStore } from '../hooks/useStore';

/**
 * One-time hint for the astral tea garden. Fades after 9s or on the first non-UI
 * click (which releases a ring of petals), and the dismissal persists in state.
 */
export function AstralTeaGardenHint() {
  const sceneId = useStore((s) => s.state.sceneId);
  const dismissed = useStore((s) => s.state.astralHintDismissed);
  const dismiss = useStore((s) => s.dismissAstralHint);
  const isAstral = sceneId === 'astral-tea-garden';

  useEffect(() => {
    if (!isAstral || dismissed) return;
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
  }, [isAstral, dismissed, dismiss]);

  if (!isAstral || dismissed) return null;
  return (
    <div className="koi-hint" aria-hidden="true">
      move to stir the petals · hold to gather them
    </div>
  );
}
