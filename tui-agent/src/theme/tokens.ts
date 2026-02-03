/**
 * Design Tokens for the TUI
 *
 * Standardized spacing, sizing, and animation values
 * for consistent visual rhythm throughout the interface.
 */

export const spacing = {
  none: 0,
  xs: 1,
  sm: 2,
  md: 3,
  lg: 4,
  xl: 6,
  xxl: 8,
} as const;

export const sizing = {
  // Panel widths (percentage or fixed)
  chatPanel: 70,           // 70% of width
  sidePanel: 30,           // 30% of width

  // Component heights
  headerHeight: 3,
  statusBarHeight: 1,
  inputAreaHeight: 3,

  // Minimum dimensions
  minWidth: 80,
  minHeight: 24,
} as const;

export const borders = {
  style: {
    none: undefined,
    single: 'single',
    double: 'double',
    rounded: 'rounded',
  } as const,

  radius: {
    none: 0,
    sm: 1,
    md: 2,
    lg: 3,
  } as const,
} as const;

export const typography = {
  // Character widths for layout calculations
  maxLineWidth: 80,
  codeBlockWidth: 76,

  // Truncation
  truncateLength: {
    short: 20,
    medium: 40,
    long: 60,
  },
} as const;

export const animation = {
  // Spinner frames (ASCII art animation)
  spinnerFrames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  spinnerInterval: 80, // ms

  // Pulse animation for thinking state
  pulseFrames: ['●', '◐', '○', '◑'],
  pulseInterval: 200, // ms

  // Streaming cursor
  cursorFrames: ['▌', ' '],
  cursorInterval: 500, // ms
} as const;

export const keybindings = {
  // Message input
  send: 'Enter',
  newline: 'Shift+Enter',

  // Panel toggles
  toggleThought: 't',
  toggleReasoning: 'r',
  toggleTools: 'o',
  toggleSessions: 's',

  // Theme
  toggleTheme: 'T', // Shift+T

  // Model picker
  toggleModel: 'm',

  // Tool approval
  approve: 'y',
  reject: 'n',

  // Navigation
  scrollUp: 'k',
  scrollDown: 'j',
  pageUp: 'PageUp',
  pageDown: 'PageDown',

  // Session management
  newSession: 'Ctrl+N',
  resumeSession: 'Ctrl+R',

  // General
  exit: 'Ctrl+C',
  help: '?',
} as const;

export type Spacing = typeof spacing;
export type Sizing = typeof sizing;
export type Borders = typeof borders;
export type Typography = typeof typography;
export type Animation = typeof animation;
export type Keybindings = typeof keybindings;
