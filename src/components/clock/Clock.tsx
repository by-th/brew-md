import { dateLine, greeting, POEMS, timeParts } from '../../lib/time';
import type { ClockFace } from '../../lib/state';
import { Motion } from '../Motion';

type FaceProps = {
  d: Date;
  h24: boolean;
  accent: string;
  fg: string;
  name: string;
  poemIdx: number;
};

const SHADOW = 'var(--text-shadow)';

function ClockSerif({ d, h24, fg }: FaceProps) {
  const t = timeParts(d, h24);
  return (
    <div style={{ textAlign: 'center', color: fg, textShadow: SHADOW }}>
      <div
        style={{
          fontFamily: 'var(--serif)', fontWeight: 300, lineHeight: 0.9,
          fontSize: 'clamp(64px, 15vw, 188px)', letterSpacing: '-.01em',
          display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '.06em',
        }}
      >
        <Motion text={t.h} />
        <span style={{ opacity: 0.55 }}>:</span>
        <Motion text={t.m} />
        {!h24 && (
          <Motion
            text={t.ampm}
            style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: '.26em', fontWeight: 400, marginLeft: '.14em', opacity: 0.82 }}
          />
        )}
      </div>
      <div style={{ fontFamily: 'var(--serif-alt)', fontStyle: 'italic', fontSize: 'clamp(20px,2.4vw,30px)', marginTop: 14, opacity: 0.92 }}>
        <Motion text={dateLine(d)} reveal />
      </div>
    </div>
  );
}

function ClockMinimal({ d, h24, fg }: FaceProps) {
  const t = timeParts(d, h24);
  return (
    <div style={{ textAlign: 'center', color: fg, textShadow: SHADOW }}>
      <div
        style={{
          fontFamily: 'var(--sans)', fontWeight: 300, lineHeight: 1,
          fontSize: 'clamp(56px,12vw,150px)', letterSpacing: '.02em', fontVariantNumeric: 'tabular-nums',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Motion text={t.h} />
        <span style={{ opacity: 0.5, margin: '0 .04em' }}>:</span>
        <Motion text={t.m} />
        {!h24 && (
          <Motion
            text={t.ampm}
            style={{ fontSize: '.2em', fontWeight: 500, letterSpacing: '.2em', textTransform: 'uppercase', marginLeft: '.4em', opacity: 0.7 }}
          />
        )}
      </div>
      <div style={{ fontSize: 'clamp(11px,1.2vw,14px)', letterSpacing: '.42em', textTransform: 'uppercase', marginTop: 20, opacity: 0.74, fontWeight: 500, paddingLeft: '.42em' }}>
        <Motion text={dateLine(d)} reveal />
      </div>
    </div>
  );
}

function ClockAnalog({ d, accent, fg }: FaceProps) {
  const s = d.getSeconds();
  const m = d.getMinutes();
  const h = d.getHours() % 12;
  const sa = s * 6;
  const ma = m * 6 + s * 0.1;
  const ha = h * 30 + m * 0.5;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const ticks = [];
  for (let i = 0; i < 12; i++) {
    const a = rad(i * 30);
    const r1 = i % 3 === 0 ? 40 : 43;
    const r2 = 46;
    ticks.push(
      <line
        key={i}
        x1={50 + Math.sin(a) * r1} y1={50 - Math.cos(a) * r1}
        x2={50 + Math.sin(a) * r2} y2={50 - Math.cos(a) * r2}
        stroke={fg} strokeOpacity={0.85} strokeWidth={i % 3 === 0 ? 1.6 : 0.8} strokeLinecap="round"
      />,
    );
  }
  return (
    <div style={{ textAlign: 'center', color: fg }}>
      <div style={{ width: 'clamp(220px,34vw,330px)', aspectRatio: '1', margin: '0 auto', filter: 'drop-shadow(0 14px 40px rgba(8,22,16,.5))' }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <circle cx="50" cy="50" r="47.5" fill={fg} fillOpacity={0.06} stroke={fg} strokeOpacity={0.45} strokeWidth="0.6" />
          {ticks}
          <line x1="50" y1="50" x2={50 + Math.sin(rad(ha)) * 26} y2={50 - Math.cos(rad(ha)) * 26} stroke={fg} strokeWidth="2.6" strokeLinecap="round" />
          <line x1="50" y1="50" x2={50 + Math.sin(rad(ma)) * 37} y2={50 - Math.cos(rad(ma)) * 37} stroke={fg} strokeWidth="1.8" strokeLinecap="round" />
          <line x1={50 - Math.sin(rad(sa)) * 7} y1={50 + Math.cos(rad(sa)) * 7} x2={50 + Math.sin(rad(sa)) * 40} y2={50 - Math.cos(rad(sa)) * 40} stroke={accent} strokeWidth="0.9" strokeLinecap="round" />
          <circle cx="50" cy="50" r="2.1" fill={accent} />
        </svg>
      </div>
      <div style={{ fontFamily: 'var(--serif-alt)', fontStyle: 'italic', fontSize: 'clamp(18px,2.2vw,27px)', marginTop: 18, opacity: 0.92, textShadow: SHADOW }}>
        <Motion text={dateLine(d)} reveal />
      </div>
    </div>
  );
}

function ClockPoetic({ d, h24, fg, name, poemIdx }: FaceProps) {
  const t = timeParts(d, h24);
  const hello = greeting(d) + (name ? `, ${name}` : '');
  return (
    <div style={{ textAlign: 'center', color: fg, maxWidth: 560, textShadow: SHADOW }}>
      <div style={{ fontFamily: 'var(--serif-alt)', fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(26px,3.4vw,44px)', opacity: 0.95 }}>
        <Motion text={hello} reveal />
      </div>
      <div
        style={{
          fontFamily: 'var(--serif)', fontWeight: 300, lineHeight: 0.92,
          fontSize: 'clamp(58px,9vw,120px)', letterSpacing: '-.01em', margin: '6px 0 2px',
          display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '.05em',
        }}
      >
        <Motion text={t.h} />
        <span style={{ opacity: 0.5 }}>:</span>
        <Motion text={t.m} />
        {!h24 && (
          <Motion text={t.ampm} style={{ fontStyle: 'italic', fontSize: '.26em', opacity: 0.8, marginLeft: '.1em' }} />
        )}
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(18px,2.1vw,25px)', fontStyle: 'italic', opacity: 0.8, marginTop: 14 }}>
        <Motion text={POEMS[poemIdx % POEMS.length]} reveal />
      </div>
    </div>
  );
}

export function Clock({ face, ...rest }: FaceProps & { face: ClockFace }) {
  if (face === 'minimal') return <ClockMinimal {...rest} />;
  if (face === 'analog') return <ClockAnalog {...rest} />;
  if (face === 'poetic') return <ClockPoetic {...rest} />;
  return <ClockSerif {...rest} />;
}
