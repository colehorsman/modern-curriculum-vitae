/**
 * Design System
 * 
 * Neo-brutalism design system with WCAG compliance.
 * @see Requirements 9.1-9.5
 */

import type { ColorScheme, TypographyConfig, LayoutConfig, DesignConfig } from '../types/design.js';

/**
 * Default neo-brutalism color scheme
 */
export const DEFAULT_COLOR_SCHEME: ColorScheme = {
  primary: '#FF6B6B',
  secondary: '#4ECDC4',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#666666',
  border: '#1A1A1A',
  accent: '#FFE66D',
};

/**
 * Default typography config
 */
export const DEFAULT_TYPOGRAPHY: TypographyConfig = {
  headingFont: 'Space Grotesk, sans-serif',
  bodyFont: 'Inter, sans-serif',
  monoFont: 'JetBrains Mono, monospace',
  baseFontSize: 16,
  lineHeight: 1.6,
  headingWeight: 700,
};

/**
 * Default layout config
 */
export const DEFAULT_LAYOUT: LayoutConfig = {
  maxWidth: 1200,
  borderWidth: 3,
  borderRadius: 0, // Neo-brutalism = no rounded corners
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  breakpoints: { mobile: 320, tablet: 768, desktop: 1024, wide: 1440 },
};

/**
 * Calculates contrast ratio between two colors
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const lum1 = getRelativeLuminance(color1);
  const lum2 = getRelativeLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Gets relative luminance of a color
 */
function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  const [r, g, b] = rgb.map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Converts hex to RGB
 */
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

/**
 * Checks if contrast meets WCAG AA standards
 * @see Requirements 9.5
 */
export function meetsWCAGAA(
  textColor: string,
  bgColor: string,
  isLargeText: boolean = false
): boolean {
  const ratio = calculateContrastRatio(textColor, bgColor);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * DesignSystem class
 */
export class DesignSystem {
  private config: DesignConfig;

  constructor(config: Partial<DesignConfig> = {}) {
    this.config = {
      colorScheme: { ...DEFAULT_COLOR_SCHEME, ...config.colorScheme },
      typography: { ...DEFAULT_TYPOGRAPHY, ...config.typography },
      layout: { ...DEFAULT_LAYOUT, ...config.layout },
    };
  }

  getConfig(): DesignConfig {
    return this.config;
  }

  /**
   * Validates color contrast for WCAG compliance
   */
  validateContrast(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const { colorScheme } = this.config;

    if (!meetsWCAGAA(colorScheme.text, colorScheme.background)) {
      issues.push('Text/background contrast does not meet WCAG AA');
    }
    if (!meetsWCAGAA(colorScheme.textMuted, colorScheme.background)) {
      issues.push('Muted text/background contrast does not meet WCAG AA');
    }

    return { valid: issues.length === 0, issues };
  }

  /**
   * Generates CSS variables
   */
  generateCSSVariables(): string {
    const { colorScheme: c, typography: t, layout: l } = this.config;
    return `
:root {
  --color-primary: ${c.primary};
  --color-secondary: ${c.secondary};
  --color-background: ${c.background};
  --color-surface: ${c.surface};
  --color-text: ${c.text};
  --color-text-muted: ${c.textMuted};
  --color-border: ${c.border};
  --color-accent: ${c.accent};
  --font-heading: ${t.headingFont};
  --font-body: ${t.bodyFont};
  --font-mono: ${t.monoFont};
  --font-size-base: ${t.baseFontSize}px;
  --line-height: ${t.lineHeight};
  --font-weight-heading: ${t.headingWeight};
  --max-width: ${l.maxWidth}px;
  --border-width: ${l.borderWidth}px;
  --border-radius: ${l.borderRadius}px;
  --spacing-xs: ${l.spacing.xs}px;
  --spacing-sm: ${l.spacing.sm}px;
  --spacing-md: ${l.spacing.md}px;
  --spacing-lg: ${l.spacing.lg}px;
  --spacing-xl: ${l.spacing.xl}px;
}`.trim();
  }
}

export const designSystem = new DesignSystem();
