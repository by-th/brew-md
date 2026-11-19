import { Panel } from './Panel';
import { Icon } from '../icons';
import { Motion } from '../Motion';
import { scenes } from '../../data/scenes';
import { useStore } from '../../hooks/useStore';

/** Scene picker. Thumbnails are the scene's own gradient layers (no images). */
export function ScenePanel({ onClose }: { onClose: () => void }) {
  const sceneId = useStore((s) => s.state.sceneId);
  const setScene = useStore((s) => s.setScene);

  return (
    <Panel title="scenes" icon={Icon.scenes} side="left" onClose={onClose}>
      <div className="scenes">
        {scenes.map((s) => (
          <button
            key={s.id}
            className={'scene-card' + (s.id === sceneId ? ' sel' : '')}
            onClick={() => setScene(s.id)}
            aria-pressed={s.id === sceneId}
            aria-label={s.name}
          >
            {s.layers.slice(0, 3).map((l, i) => (
              <span
                key={i}
                className="sc-bg"
                style={{
                  background: l.css,
                  mixBlendMode: (l.blend as React.CSSProperties['mixBlendMode']) ?? 'normal',
                  opacity: l.opacity ?? 1,
                }}
              />
            ))}
            <span className="tick">{Icon.check}</span>
            <Motion className="sc-name" text={s.name} reveal />
          </button>
        ))}
      </div>
    </Panel>
  );
}
