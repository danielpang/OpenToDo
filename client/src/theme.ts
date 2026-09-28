/**
 * OpenToDo client design tokens.
 *
 * This is the single source of truth for color, spacing, typography and motion
 * tokens used by the shell. Tailwind utility classes that mirror these values
 * live in `tailwind.config.js`; tokens referenced directly from TSX (the spring
 * easing on the Layout header, the accent bar) come from here.
 */

export type Theme = typeof theme;
export type MotionToken = (typeof motion)[keyof typeof motion];

export const theme = {
  colors: {
    // Brand colors are deliberately distinct: sky (primary) and amber (accent).
    primary: '#0ea5e6',
    accent: '#f59e0b',
    light: {
      base: '#f8fafc',
      surface: '#ffffff',
      surfaceAlt: '#f1f5f9',
      border: '#e2e8f0',
      text: '#0f172a',
      textMuted: '#64748b',
    },
    dark: {
      base: '#0f172a',
      surface: '#1e293b',
      surfaceAlt: '#334155',
      border: '#475569',
      text: '#f1f5f9',
      textMuted: '#94a3b8',
    },
  },
  radii: { sm: '4px', md: '8px', lg: '12px', xl: '16px', full: '9999px' },
  spacing: { xs: '0.25rem', sm: '0.5rem', md: '0.75rem', lg: '2rem', xl: '3rem' },
  fonts: {
    body: 'ui-sans, system-ui, sans-serif',
    mono: 'ui-monospace, monospace',
  },
} as const;

// Motion tokens. `spring` overshoots slightly — playful without being gaudy.
export const motion = {
  spring: { easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', duration: '350ms' },
  easeInOut: { easing: 'cubic-bezier(0.4, 0, 0.2, 1)', duration: '200ms' },
} as const;
