import { useEffect, type ReactElement, type ReactNode } from 'react';
import { Icon } from '../icons';
import { Motion } from '../Motion';

/** Quiet slide-out panel (bottom sheet on mobile). Closes on backdrop + Esc. */
export function Panel({
  title,
  icon,
  side = 'right',
  onClose,
  children,
}: {
  title: string;
  icon: ReactElement;
  side?: 'left' | 'right';
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <button className="scrim-backdrop" aria-label="close panel" onClick={onClose} />
      <div className={'panel panel-' + side} role="dialog" aria-modal="false" aria-label={title}>
        <div className="panel-h">
          <div className="panel-title">
            {icon}
            <Motion text={title} reveal />
          </div>
          <button className="panel-x" onClick={onClose} aria-label="close">
            {Icon.x}
          </button>
        </div>
        <div className="panel-body">{children}</div>
      </div>
    </>
  );
}
