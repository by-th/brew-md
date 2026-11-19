import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { useStore } from '../hooks/useStore';
import { useDragTap } from '../hooks/useDragTap';
import { useIsMobile } from '../hooks/useMediaQuery';
import { Motion } from './Motion';
import { QUOTES } from '../data/quotes';

/**
 * A single rotating motivational quote. Tap for the next one, drag to move;
 * rotates on its own every ~22s. Hideable from the control panel or its ✕.
 */
export function QuoteBar() {
  const ref = useRef<HTMLDivElement>(null);
  const show = useStore((s) => s.state.showQuotes);
  const toggle = useStore((s) => s.toggleQuotes);
  const pos = useStore((s) => s.state.quotePos);
  const setPos = useStore((s) => s.setQuotePos);
  const [i, setI] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const next = () => setI((p) => (p + 1) % QUOTES.length);
  const mobile = useIsMobile();
  const startDrag = useDragTap(ref, setPos, next, mobile);

  useEffect(() => {
    if (!show) return;
    const t = setInterval(next, 22000);
    return () => clearInterval(t);
  }, [show]);

  if (!show) return null;
  // On mobile, ignore any desktop-saved position and keep the centered default.
  const style = pos && !mobile ? { left: pos.x, top: pos.y, transform: 'none' } : undefined;

  return (
    <div
      ref={ref}
      className="quote-bar"
      style={style}
      onPointerDown={startDrag}
      title="tap for the next quote · drag to move"
    >
      <Motion className="quote-text" text={`“${QUOTES[i]}”`} options={{ stagger: 16, duration: 260 }} />
      <button
        className="quote-x"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={toggle}
        aria-label="hide quotes"
      >
        {Icon.x}
      </button>
    </div>
  );
}
