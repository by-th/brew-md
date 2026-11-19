import { Panel } from '../panels/Panel';
import { Icon } from '../icons';
import { SOUND_LAYERS } from '../../data/sounds';
import { useStore } from '../../hooks/useStore';

const DEFAULT_ON = 0.5;

/** Ambient sound mixer: master + a slider/toggle per global layer. */
export function Mixer({ onClose }: { onClose: () => void }) {
  const soundLevels = useStore((s) => s.state.soundLevels);
  const master = useStore((s) => s.state.masterVolume);
  const setLayer = useStore((s) => s.setLayer);
  const setMaster = useStore((s) => s.setMaster);

  return (
    <Panel title="sounds" icon={Icon.music} side="right" onClose={onClose}>
      <div className="row" style={{ paddingTop: 6 }}>
        <span className="row-ic on">{Icon.vol}</span>
        <div className="row-main">
          <div className="row-name">master volume</div>
          <input
            className="sl"
            type="range"
            min={0}
            max={100}
            value={Math.round(master * 100)}
            onChange={(e) => setMaster(Number(e.target.value) / 100)}
            aria-label="master volume"
          />
        </div>
      </div>

      <div className="label">sound mix</div>
      {SOUND_LAYERS.map((l) => {
        const lvl = soundLevels[l.id] ?? 0;
        const on = lvl > 0;
        return (
          <div className="row" key={l.id}>
            <button
              className={'row-ic' + (on ? ' on' : '')}
              onClick={() => setLayer(l.id, on ? 0 : DEFAULT_ON)}
              aria-label={on ? `turn off ${l.label}` : `turn on ${l.label}`}
            >
              {Icon[l.icon]}
            </button>
            <div className="row-main">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={'row-name' + (on ? '' : ' off')}>{l.label}</span>
                <div
                  className="sw"
                  data-on={on ? '1' : '0'}
                  role="switch"
                  aria-checked={on}
                  aria-label={l.label}
                  onClick={() => setLayer(l.id, on ? 0 : DEFAULT_ON)}
                >
                  <i />
                </div>
              </div>
              <input
                className="sl"
                type="range"
                min={0}
                max={100}
                value={Math.round(lvl * 100)}
                onChange={(e) => setLayer(l.id, Number(e.target.value) / 100)}
                aria-label={`${l.label} level`}
              />
            </div>
          </div>
        );
      })}
    </Panel>
  );
}
