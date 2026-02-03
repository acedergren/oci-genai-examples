/**
 * Golden Hour Theme - Light Mode OKLCH Colors
 *
 * Inspired by warm sunset tones - cream backgrounds with
 * warm amber accents. Designed for comfortable daytime reading.
 */

// OKLCH to RGB conversion utilities
function oklchToRgb(l: number, c: number, h: number): [number, number, number] {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  const r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bVal = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

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
 * Golden Hour Theme Colors
 *
 * Warm cream backgrounds with amber accents
 * Designed for comfortable daytime reading.
 */
export const lightColors = {
  // Background colors - warm cream tones
  bg: {
    primary: oklchToHex(0.97, 0.02, 75),      // Warm cream
    secondary: oklchToHex(0.94, 0.025, 70),   // Slightly darker cream
    tertiary: oklchToHex(0.99, 0.015, 80),    // Lightest for contrast
    elevated: oklchToHex(0.92, 0.03, 65),     // Elevated surfaces
    hover: oklchToHex(0.90, 0.035, 60),       // Hover state
  },

  // Foreground colors - warm darks
  fg: {
    primary: oklchToHex(0.25, 0.02, 60),      // Warm near-black
    secondary: oklchToHex(0.40, 0.02, 60),    // Muted for secondary text
    tertiary: oklchToHex(0.55, 0.02, 60),     // Dim text
    disabled: oklchToHex(0.70, 0.01, 60),     // Disabled state
  },

  // Accent colors - sunset warmth
  accent: {
    primary: oklchToHex(0.65, 0.18, 45),      // Deep sunset orange
    secondary: oklchToHex(0.60, 0.15, 35),    // Burnt amber
    muted: oklchToHex(0.70, 0.10, 50),        // Muted orange
  },

  // Agent states - animated feedback colors
  agent: {
    thinking: oklchToHex(0.55, 0.15, 180),    // Teal pulse
    executing: oklchToHex(0.65, 0.18, 45),    // Orange active
    waiting: oklchToHex(0.50, 0.12, 280),     // Purple idle
    streaming: oklchToHex(0.58, 0.16, 160),   // Cyan streaming
  },

  // Semantic colors
  semantic: {
    success: oklchToHex(0.55, 0.18, 145),     // Green
    warning: oklchToHex(0.70, 0.18, 75),      // Yellow-orange
    error: oklchToHex(0.55, 0.20, 25),        // Red
    info: oklchToHex(0.55, 0.15, 230),        // Blue
  },

  // Tool approval colors
  tool: {
    safe: oklchToHex(0.55, 0.18, 145),        // Green - auto-approve
    caution: oklchToHex(0.70, 0.18, 75),      // Yellow - confirm
    danger: oklchToHex(0.55, 0.20, 25),       // Red - destructive
  },

  // Border colors
  border: {
    default: oklchToHex(0.80, 0.03, 70),      // Subtle warm border
    focused: oklchToHex(0.65, 0.18, 45),      // Accent when focused
    muted: oklchToHex(0.88, 0.02, 75),        // Very subtle
  },
} as const;

export type LightThemeColors = typeof lightColors;
