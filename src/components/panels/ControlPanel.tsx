import { Panel } from './Panel';
import { Icon } from '../icons';
import { useStore } from '../../hooks/useStore';
import { FONT_THEMES } from '../../lib/fonts';
import type { ClockFace } from '../../lib/state';

const FACES: { v: ClockFace; l: string }[] = [
  { v: 'serif', l: 'serif' },
  { v: 'minimal', l: 'minimal' },
  { v: 'analog', l: 'analog' },
  { v: 'poetic', l: 'poetic' },
];

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <div className="ctl-row">
      <span className="ctl-row-name">{label}</span>
      <button className="sw" data-on={on ? 1 : 0} onClick={onClick} role="switch" aria-checked={on} aria-label={label}>
        <i />
      </button>
    </div>
  );
}

/** The everything panel: identity, fonts, clock, and what's shown on screen. */
export function ControlPanel({ onClose }: { onClose: () => void }) {
  const name = useStore((s) => s.state.clock.name);
  const setName = useStore((s) => s.setName);
  const face = useStore((s) => s.state.clock.face);
  const setFace = useStore((s) => s.setClockFace);
  const h24 = useStore((s) => s.state.clock.h24);
  const setH24 = useStore((s) => s.setH24);
  const fontTheme = useStore((s) => s.state.fontTheme);
  const setFontTheme = useStore((s) => s.setFontTheme);
  const showGreeting = useStore((s) => s.state.showGreeting);
  const toggleGreeting = useStore((s) => s.toggleGreeting);
  const showQuotes = useStore((s) => s.state.showQuotes);
  const toggleQuotes = useStore((s) => s.toggleQuotes);
  const showNotepad = useStore((s) => s.state.showNotepad);
  const toggleNotepad = useStore((s) => s.toggleNotepad);

  return (
    <Panel title="control panel" icon={Icon.gear} side="left" onClose={onClose}>
      <div className="label">your name</div>
      <input
        className="field"
        value={name}
        maxLength={24}
        placeholder="add your name"
        onChange={(e) => setName(e.target.value)}
        aria-label="your name"
      />

      <div className="label">font</div>
      <div className="pills">
        {FONT_THEMES.map((f) => (
          <button
            key={f.id}
            className={'pill' + (fontTheme === f.id ? ' sel' : '')}
            onClick={() => setFontTheme(f.id)}
            aria-pressed={fontTheme === f.id}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="label">clock face</div>
      <div className="pills">
        {FACES.map((f) => (
          <button
            key={f.v}
            className={'pill' + (face === f.v ? ' sel' : '')}
            onClick={() => setFace(f.v)}
            aria-pressed={face === f.v}
          >
            {f.l}
          </button>
        ))}
      </div>

      <div className="label">display</div>
      <Switch label="24-hour clock" on={h24} onClick={() => setH24(!h24)} />
      <Switch label="greeting" on={showGreeting} onClick={toggleGreeting} />
      <Switch label="quotes" on={showQuotes} onClick={toggleQuotes} />
      <Switch label="notepad" on={showNotepad} onClick={toggleNotepad} />
    </Panel>
  );
}
