import { useRef } from 'react';
import { Clock } from './Clock';
import { useStore } from '../../hooks/useStore';
import { getScene } from '../../data/scenes';
import { useNow, usePoemIndex } from '../../hooks/useClock';
import { useDrag } from '../../hooks/useDrag';
import { useIsMobile } from '../../hooks/useMediaQuery';

/** The centerpiece clock: draggable on desktop, centered on mobile (via CSS). */
export function ClockWidget() {
  const ref = useRef<HTMLDivElement>(null);
  const clock = useStore((s) => s.state.clock);
  const sceneId = useStore((s) => s.state.sceneId);
  const setClockPos = useStore((s) => s.setClockPos);

  const now = useNow();
  const poemIdx = usePoemIndex();
  const mobile = useIsMobile();
  const startDrag = useDrag(ref, setClockPos);

  const palette = getScene(sceneId).palette;

  // On mobile the widget is CSS-pinned to center; ignore any desktop-saved pos.
  const style: React.CSSProperties = clock.pos && !mobile
    ? { left: clock.pos.x, top: clock.pos.y }
    : { left: '50%', top: '44%', transform: 'translate(-50%,-50%)' };

  return (
    <div ref={ref} className="widget" style={{ position: 'fixed', ...style }}>
      <div className="clock-scrim" />
      <div className="clock-grab" onPointerDown={mobile ? undefined : startDrag} title="drag to reposition">
        <Clock
          face={clock.face}
          d={now}
          h24={clock.h24}
          accent={palette.accent}
          fg={palette.foreground}
          name={clock.name}
          poemIdx={poemIdx}
        />
      </div>
    </div>
  );
}
