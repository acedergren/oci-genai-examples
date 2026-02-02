/**
 * Running Days Theme - OKLCH Color System
 *
 * Colors are defined in OKLCH for perceptual uniformity, then converted to hex
 * for terminal rendering compatibility. OKLCH provides:
 * - L: Lightness (0-1)
 * - C: Chroma (0-0.4 typical)
 * - H: Hue (0-360 degrees)
 */

// OKLCH to RGB conversion utilities
function oklchToRgb(l: number, c: number, h: number): [number, number, number] {
  // Convert OKLCH to OKLab
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  // OKLab to linear RGB
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  const r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bVal = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  // Clamp and gamma correct
  const toSrgb = (x: number) => {
    const clamped = Math.max(0, Math.min(1, x));
    return clamped <= 0.0031308
      ? clamped * 12.92
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  };

  return [
    Math.round(toSrgb(r) * 255),
    Math.round(toSrgb(g) * 255),
    Math.round(toSrgb(bVal) * 255),
  ];
}

function oklchToHex(l: number, c: number, h: number): string {
  const [r, g, b] = oklchToRgb(l, c, h);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Running Days Theme Colors
 *
 * Inspired by bioluminescent ocean depths - dark blue-black backgrounds
 * with warm orange/amber accents that pulse with life.
 */
export const colors = {
  // Background colors - deep ocean blues
  bg: {
    primary: oklchToHex(0.15, 0.02, 260),      // Deep blue-black
    secondary: oklchToHex(0.18, 0.025, 260),   // Slightly lighter
    tertiary: oklchToHex(0.12, 0.015, 260),    // Darker for contrast
    elevated: oklchToHex(0.20, 0.03, 260),     // Elevated surfaces
    hover: oklchToHex(0.22, 0.035, 260),       // Hover state
  },

  // Foreground colors - soft whites
  fg: {
    primary: oklchToHex(0.95, 0.02, 210),      // Near-white with cool tint
    secondary: oklchToHex(0.75, 0.02, 210),    // Muted for secondary text
    tertiary: oklchToHex(0.55, 0.02, 210),     // Dim text
    disabled: oklchToHex(0.40, 0.01, 210),     // Disabled state
  },

  // Accent colors - bioluminescent warmth
  accent: {
    primary: oklchToHex(0.75, 0.18, 40),       // Warm orange
    secondary: oklchToHex(0.70, 0.15, 50),     // Amber
    muted: oklchToHex(0.55, 0.10, 40),         // Muted orange
  },

  // Agent states - animated feedback colors
  agent: {
    thinking: oklchToHex(0.70, 0.15, 180),     // Teal pulse
    executing: oklchToHex(0.75, 0.18, 40),     // Orange active
    waiting: oklchToHex(0.60, 0.12, 280),      // Purple idle
    streaming: oklchToHex(0.72, 0.16, 160),    // Cyan streaming
  },

  // Semantic colors
  semantic: {
    success: oklchToHex(0.70, 0.18, 145),      // Green
    warning: oklchToHex(0.75, 0.18, 75),       // Yellow-orange
    error: oklchToHex(0.65, 0.20, 25),         // Red
    info: oklchToHex(0.70, 0.15, 230),         // Blue
  },

  // Tool approval colors
  tool: {
    safe: oklchToHex(0.70, 0.18, 145),         // Green - auto-approve
    caution: oklchToHex(0.75, 0.18, 75),       // Yellow - confirm
    danger: oklchToHex(0.65, 0.20, 25),        // Red - destructive
  },

  // Border colors
  border: {
    default: oklchToHex(0.30, 0.03, 260),      // Subtle border
    focused: oklchToHex(0.75, 0.18, 40),       // Accent when focused
    muted: oklchToHex(0.22, 0.02, 260),        // Very subtle
  },
} as const;

export type ThemeColors = typeof colors;
