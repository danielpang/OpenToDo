import { describe, it, expect } from 'vitest';
import { theme, motion } from './theme';

describe('theme tokens', () => {
  it('defines distinct primary and accent colors', () => {
    expect(theme.colors.primary).toMatch(/^#([0-9a-f]{3}){1,2}$/i);
    expect(theme.colors.accent).toMatch(/^#([0-9a-f]{3}){1,2}$/i);
    expect(theme.colors.primary).not.toBe(theme.colors.accent);
  });

  it('defines light and dark surface palettes', () => {
    expect(theme.colors.light.base).toBeTruthy();
    expect(theme.colors.light.surface).toBeTruthy();
    expect(theme.colors.dark.base).toBeTruthy();
    expect(theme.colors.dark.surface).toBeTruthy();
  });

  it('defines a spring motion token backed by an overshooting curve', () => {
    expect(motion.spring.easing).toMatch(/cubic-bezier/);
    expect(motion.spring.duration).toMatch(/ms$/);
  });
});
