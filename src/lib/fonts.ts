// Selectable font themes. Each reassigns the three font CSS variables the whole
// UI reads (--serif, --serif-alt, --sans). Applied as inline vars on .app-shell.

export type FontThemeId = 'classic' | 'modern' | 'grotesk' | 'mono';

export type FontTheme = {
  id: FontThemeId;
  label: string;
  serif: string;
  serifAlt: string;
  sans: string;
};

export const FONT_THEMES: FontTheme[] = [
  {
    id: 'classic',
    label: 'classic',
    serif: "'Cormorant Garamond', Georgia, serif",
    serifAlt: "'Playfair Display', Georgia, serif",
    sans: "'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: 'modern',
    label: 'modern',
    serif: "'Fraunces', Georgia, serif",
    serifAlt: "'Fraunces', Georgia, serif",
    sans: "'Inter', ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: 'grotesk',
    label: 'grotesk',
    serif: "'Space Grotesk', sans-serif",
    serifAlt: "'Space Grotesk', sans-serif",
    sans: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: 'mono',
    label: 'mono',
    serif: "'Cormorant Garamond', Georgia, serif",
    serifAlt: "'Cormorant Garamond', Georgia, serif",
    sans: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
  },
];

export const DEFAULT_FONT_THEME: FontThemeId = 'classic';

/** The CSS-variable overrides for a font theme id (falls back to classic). */
export function fontVars(id: string): Record<string, string> {
  const t = FONT_THEMES.find((f) => f.id === id) ?? FONT_THEMES[0];
  return { '--serif': t.serif, '--serif-alt': t.serifAlt, '--sans': t.sans };
}
