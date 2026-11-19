import { useEffect } from 'react';
import { useStore } from '../hooks/useStore';

/**
 * One-time hint for the clockwork conservatory. Fades after 9s or on the first
 * non-UI click (which plants a glowing seed), and the dismissal persists in state.
 */
export function ConservatoryHint() {
  const sceneId = useStore((s) => s.state.sceneId);
  const dismissed = useStore((s) => s.state.conservatoryHintDismissed);
  const dismiss = useStore((s) => s.dismissConservatoryHint);
  const isConservatory = sceneId === 'clockwork-conservatory';

  useEffect(() => {
    if (!isConservatory || dismissed) return;
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
  }, [isConservatory, dismissed, dismiss]);

  if (!isConservatory || dismissed) return null;
  return (
    <div className="koi-hint" aria-hidden="true">
      move to stir the fireflies · click the earth to plant a light
    </div>
  );
}
