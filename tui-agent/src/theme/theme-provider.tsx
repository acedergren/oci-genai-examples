import React, { createContext, useContext, type ReactNode } from 'react';
import { colors, type ThemeColors } from './colors.js';
import {
  spacing,
  sizing,
  borders,
  typography,
  animation,
  keybindings,
  type Spacing,
  type Sizing,
  type Borders,
  type Typography,
  type Animation,
  type Keybindings,
} from './tokens.js';

export interface Theme {
  colors: ThemeColors;
  spacing: Spacing;
  sizing: Sizing;
  borders: Borders;
  typography: Typography;
  animation: Animation;
  keybindings: Keybindings;
}

const defaultTheme: Theme = {
  colors,
  spacing,
  sizing,
  borders,
  typography,
  animation,
  keybindings,
};

const ThemeContext = createContext<Theme>(defaultTheme);

export interface ThemeProviderProps {
  children: ReactNode;
  theme?: Partial<Theme>;
}

export function ThemeProvider({ children, theme }: ThemeProviderProps) {
  const mergedTheme: Theme = theme
    ? {
        colors: { ...defaultTheme.colors, ...theme.colors },
        spacing: { ...defaultTheme.spacing, ...theme.spacing },
        sizing: { ...defaultTheme.sizing, ...theme.sizing },
        borders: { ...defaultTheme.borders, ...theme.borders },
        typography: { ...defaultTheme.typography, ...theme.typography },
        animation: { ...defaultTheme.animation, ...theme.animation },
        keybindings: { ...defaultTheme.keybindings, ...theme.keybindings },
      }
    : defaultTheme;

  return (
    <ThemeContext.Provider value={mergedTheme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

// Convenience hooks for specific theme sections
export function useColors(): ThemeColors {
  return useTheme().colors;
}

export function useSpacing(): Spacing {
  return useTheme().spacing;
}

export function useSizing(): Sizing {
  return useTheme().sizing;
}

export function useAnimation(): Animation {
  return useTheme().animation;
}

export function useKeybindings(): Keybindings {
  return useTheme().keybindings;
}

// Re-export theme values for direct imports
export { colors, spacing, sizing, borders, typography, animation, keybindings };
