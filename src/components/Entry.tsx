import { useEffect } from 'react';
import { useUI } from '../hooks/useUI';
import { audioEngine } from '../audio/engine';

/**
 * The "enter the room" gesture (autoplay policy). Shown dimmed over the scene
 * until the first click or keypress, which unlocks audio (engine fades in over
 * ~2s) and lifts the dim. Returning visitors see it once too, made quiet and
 * intentional rather than a banner.
 */
export function Entry() {
  const entered = useUI((s) => s.entered);
  const setEntered = useUI((s) => s.setEntered);

  useEffect(() => {
    if (entered) return;
    const enter = () => {
      audioEngine.unlock(); // create + resume within the gesture
      setEntered(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      enter();
    };
    window.addEventListener('keydown', onKey, { once: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [entered, setEntered]);

  if (entered) return null;

  const enter = () => {
    audioEngine.unlock();
    setEntered(true);
  };

  return (
    <div className="entry" data-ui onClick={enter} role="button" tabIndex={0} aria-label="enter brew.md">
      <div className="entry-inner">
        <div className="entry-mark">
          brew<span>.md</span>
        </div>
        <div className="entry-prompt">click anywhere, or press any key, to enter</div>
      </div>
    </div>
  );
}
