import { useCallback, type PointerEvent, type RefObject } from 'react';
import type { Pos } from '../lib/state';

/**
 * Like useDrag, but distinguishes a drag from a tap. Moving past a small
 * threshold repositions the element (absolute top-left, clamped to the viewport)
 * and toggles a `.dragging` class; a pointer-up with no real movement fires
 * `onTap` instead and leaves the position untouched.
 *
 * When `disableDrag` is true (e.g. on mobile) the element never repositions, but
 * a tap still fires `onTap`, so the tap action survives without draggable chrome.
 */
export function useDragTap(
  ref: RefObject<HTMLElement | null>,
  setPos: (p: Pos) => void,
  onTap?: () => void,
  disableDrag = false,
) {
  return useCallback(
    (e: PointerEvent) => {
      if (e.button !== 0) return;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const ox = e.clientX - r.left;
      const oy = e.clientY - r.top;
      const w = r.width;
      const h = r.height;
      const sx = e.clientX;
      const sy = e.clientY;
      let moved = false;

      const move = (ev: globalThis.PointerEvent) => {
        if (disableDrag) return;
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) <= 4) return;
        if (!moved) {
          moved = true;
          el.classList.add('dragging');
          document.body.style.userSelect = 'none';
        }
        const x = Math.max(8, Math.min(window.innerWidth - w - 8, ev.clientX - ox));
        const y = Math.max(8, Math.min(window.innerHeight - h - 8, ev.clientY - oy));
        setPos({ x, y });
      };
      const up = () => {
        el.classList.remove('dragging');
        document.body.style.userSelect = '';
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (!moved && onTap) onTap();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [ref, setPos, onTap, disableDrag],
  );
}
