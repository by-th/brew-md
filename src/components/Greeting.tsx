import { useRef } from 'react';
import { useStore } from '../hooks/useStore';
import { useNow } from '../hooks/useClock';
import { useDrag } from '../hooks/useDrag';
import { useIsMobile } from '../hooks/useMediaQuery';
import { greeting } from '../lib/time';
import { Motion } from './Motion';

/**
 * Time-of-day greeting near the top: "Good morning, <name>" + a prompt that
 * opens the notepad. Draggable like the clock; toggleable from the control panel.
 */
export function Greeting() {
  const ref = useRef<HTMLDivElement>(null);
  const show = useStore((s) => s.state.showGreeting);
  const name = useStore((s) => s.state.clock.name);
  const pos = useStore((s) => s.state.greetingPos);
  const setPos = useStore((s) => s.setGreetingPos);
  const openNotepad = useStore((s) => s.setShowNotepad);
  const now = useNow();
  const mobile = useIsMobile();
  const startDrag = useDrag(ref, setPos);

  if (!show) return null;
  const hello = greeting(now) + (name ? `, ${name}` : '');
  // On mobile, ignore any desktop-saved position and keep the centered default.
  const style = pos && !mobile ? { left: pos.x, top: pos.y, transform: 'none' } : undefined;

  return (
    <div ref={ref} className="greeting" style={style} onPointerDown={mobile ? undefined : startDrag}>
      <Motion className="greeting-hi" text={hello} reveal />
      <button className="greeting-sub" onClick={() => openNotepad(true)} title="open notes">
        What would you like to get done today?
      </button>
    </div>
  );
}
