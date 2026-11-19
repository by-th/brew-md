import type { ReactElement } from 'react';

/* Thin, rounded line-icon set (ported from the design bundle). */
export type IconName =
  | 'leaf' | 'music' | 'scenes' | 'gear' | 'play' | 'pause' | 'prev' | 'next'
  | 'x' | 'vol' | 'mute' | 'water' | 'bird' | 'wind' | 'rain' | 'chime'
  | 'cricket' | 'check' | 'thunder' | 'timer' | 'eye' | 'eyeOff' | 'noise'
  | 'fire' | 'city' | 'pad';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const Icon: Record<IconName, ReactElement> = {
  leaf: <svg viewBox="0 0 24 24" width="20" height="20" strokeWidth="1.6" {...stroke}><path d="M5 19c0-7 5-13 14-14 0 9-5 15-13 15a6 6 0 0 1-1 0Z" /><path d="M5 19C8 14 11 11 16 9" /></svg>,
  music: <svg viewBox="0 0 24 24" width="20" height="20" strokeWidth="1.6" {...stroke}><path d="M9 18V6l10-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></svg>,
  scenes: <svg viewBox="0 0 24 24" width="20" height="20" strokeWidth="1.6" {...stroke}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 16l4.5-4 3.5 3 4-5 6 6" /><circle cx="8.5" cy="9.5" r="1.4" /></svg>,
  gear: <svg viewBox="0 0 24 24" width="20" height="20" strokeWidth="1.5" {...stroke}><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19" /></svg>,
  play: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>,
  pause: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6.5" y="5.5" width="3.5" height="13" rx="1" /><rect x="14" y="5.5" width="3.5" height="13" rx="1" /></svg>,
  prev: <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M7 5.5h2.4v13H7zM19 5.5v13l-9-6.5z" /></svg>,
  next: <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M14.6 5.5H17v13h-2.4zM5 5.5v13l9-6.5z" /></svg>,
  x: <svg viewBox="0 0 24 24" width="17" height="17" strokeWidth="1.7" {...stroke}><path d="M6 6l12 12M18 6 6 18" /></svg>,
  vol: <svg viewBox="0 0 24 24" width="18" height="18" strokeWidth="1.6" {...stroke}><path d="M4 9v6h3.5L13 19V5L7.5 9z" /><path d="M16.5 9a4 4 0 0 1 0 6" /></svg>,
  mute: <svg viewBox="0 0 24 24" width="18" height="18" strokeWidth="1.6" {...stroke}><path d="M4 9v6h3.5L13 19V5L7.5 9z" /><path d="M17 9.5l4 5M21 9.5l-4 5" /></svg>,
  water: <svg viewBox="0 0 24 24" width="18" height="18" strokeWidth="1.5" {...stroke}><path d="M12 3c3.5 4.2 6 7.4 6 10.4A6 6 0 0 1 6 13.4C6 10.4 8.5 7.2 12 3Z" /></svg>,
  bird: <svg viewBox="0 0 24 24" width="18" height="18" strokeWidth="1.5" {...stroke}><path d="M3 7c3 0 4 2 7 2 0-2.5 2-4 4-4 1 3 4 2.5 4 5 0 4-3.5 7-8 7-4 0-7-2.5-7-6" /><path d="M9 12.5 7 21" /></svg>,
  wind: <svg viewBox="0 0 24 24" width="18" height="18" strokeWidth="1.5" {...stroke}><path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5M3 13h15a2.5 2.5 0 1 1-2.5 2.5M3 17h8" /></svg>,
  rain: <svg viewBox="0 0 24 24" width="18" height="18" strokeWidth="1.5" {...stroke}><path d="M7 14a4 4 0 0 1-.5-8A5 5 0 0 1 16 5.5 3.5 3.5 0 0 1 17 14" /><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2" /></svg>,
  chime: <svg viewBox="0 0 24 24" width="18" height="18" strokeWidth="1.5" {...stroke}><path d="M5 4v9M9 4v9M5 13a2 2 0 0 0 4 0M7 13v5M5.5 20.5h3" /><path d="M13 4v9M17 4v9M13 13a2 2 0 0 0 4 0M15 13v5M13.5 20.5h3" /></svg>,
  cricket: <svg viewBox="0 0 24 24" width="18" height="18" strokeWidth="1.5" {...stroke}><circle cx="12" cy="13" r="4" /><path d="M12 9V4M9 5l3 4M15 5l-3 4M8 14l-4 2M16 14l4 2M9 17l-2 3M15 17l2 3" /></svg>,
  check: <svg viewBox="0 0 24 24" width="14" height="14" strokeWidth="2.6" {...stroke}><path d="M5 12.5 10 17 19 7" /></svg>,
  thunder: <svg viewBox="0 0 24 24" width="18" height="18" strokeWidth="1.5" {...stroke}><path d="M7 16a4 4 0 0 1-.5-8A5 5 0 0 1 16 6.5 3.5 3.5 0 0 1 16.5 16" /><path d="M12 12l-2 3.5h3L11 19" /></svg>,
  timer: <svg viewBox="0 0 24 24" width="18" height="18" strokeWidth="1.6" {...stroke}><circle cx="12" cy="13" r="8" /><path d="M12 13V9M9.5 3.5h5" /></svg>,
  eye: <svg viewBox="0 0 24 24" width="18" height="18" strokeWidth="1.6" {...stroke}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>,
  eyeOff: <svg viewBox="0 0 24 24" width="18" height="18" strokeWidth="1.6" {...stroke}><path d="M4 4l16 16M10.6 6.2A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-3 3.6M6.2 7.6A16 16 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 3.5-.7" /><path d="M9.5 10.5a3 3 0 0 0 4 4" /></svg>,
  noise: <svg viewBox="0 0 24 24" width="18" height="18" strokeWidth="1.6" {...stroke}><path d="M3 12h2l2-6 3 14 3-12 2 8 2-4h4" /></svg>,
  fire: <svg viewBox="0 0 24 24" width="18" height="18" strokeWidth="1.5" {...stroke}><path d="M12 3c3 4 5 6 5 9a5 5 0 0 1-10 0c0-1.5.8-2.8 2-4 .3 1.2 1 2 2 2.2C10.5 8 11 5.5 12 3Z" /></svg>,
  city: <svg viewBox="0 0 24 24" width="18" height="18" strokeWidth="1.5" {...stroke}><path d="M3 21h18M5 21V8l5-3v16M14 21V11l5-3v13M8 9v0M8 12v0M8 15v0" /></svg>,
  pad: <svg viewBox="0 0 24 24" width="18" height="18" strokeWidth="1.6" {...stroke}><path d="M3 12a9 9 0 0 1 18 0M6.5 12a5.5 5.5 0 0 1 11 0M10 12a2 2 0 0 1 4 0" /></svg>,
};
