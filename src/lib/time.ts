// Time + greeting helpers for the clock faces (ported from the design bundle).

export type TimeParts = {
  h: string; // hour, respecting 12/24h
  m: string; // minutes, zero-padded
  s: number; // seconds (number, for analog)
  ampm: string; // 'am' | 'pm'
};

export function timeParts(d: Date, h24: boolean): TimeParts {
  let h = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
  const ampm = h < 12 ? 'am' : 'pm';
  if (!h24) {
    h = h % 12;
    if (h === 0) h = 12;
  }
  return {
    h: h24 ? String(h).padStart(2, '0') : String(h),
    m: String(m).padStart(2, '0'),
    s,
    ampm,
  };
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function dateLine(d: Date): string {
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 5) return 'Quiet hours';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

export const POEMS = [
  'The garden keeps your hours for you.',
  'Let the afternoon hold the noise.',
  'Bloom slowly. There is time.',
  'Sunlight pools where you sit and think.',
  'Stillness is its own kind of progress.',
  'The pond remembers every quiet thing.',
];
