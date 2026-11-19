import { useCallback, type PointerEvent, type RefObject } from 'react';
import type { Pos } from '../lib/state';

/**
 * Pointer-drag for free-floating surfaces (clock + panels). Reports an absolute
 * top-left position clamped to the viewport, and toggles a `.dragging` class on
 * the element for visual feedback. Commits on release.
 */
export function useDrag(ref: RefObject<HTMLElement | null>, setPos: (p: Pos) => void) {
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

      el.classList.add('dragging');
      document.body.style.userSelect = 'none';

      const move = (ev: globalThis.PointerEvent) => {
        const x = Math.max(8, Math.min(window.innerWidth - w - 8, ev.clientX - ox));
        const y = Math.max(8, Math.min(window.innerHeight - h - 8, ev.clientY - oy));
        setPos({ x, y });
      };
      const up = () => {
        el.classList.remove('dragging');
        document.body.style.userSelect = '';
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [ref, setPos],
  );
}
