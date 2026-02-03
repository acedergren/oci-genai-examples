import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { colors, darkColors, type ThemeColors } from './colors.js';
import { lightColors } from './colors-light.js';
import { useConfigStore, type ThemeMode } from '../state/config-store.js';
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
  mode: ThemeMode;
}

function getColorsForMode(mode: ThemeMode): ThemeColors {
  return mode === 'dark' ? darkColors : lightColors as ThemeColors;
}

const defaultTheme: Theme = {
  colors,
  spacing,
  sizing,
  borders,
  typography,
  animation,
  keybindings,
  mode: 'dark',
};

const ThemeContext = createContext<Theme>(defaultTheme);

export interface ThemeProviderProps {
  children: ReactNode;
  theme?: Partial<Theme>;
}

export function ThemeProvider({ children, theme }: ThemeProviderProps) {
  const themeMode = useConfigStore((s) => s.theme);
  const modeColors = getColorsForMode(themeMode);

  const mergedTheme: Theme = useMemo(() => {
    const base = {
      colors: modeColors,
      spacing: defaultTheme.spacing,
      sizing: defaultTheme.sizing,
      borders: defaultTheme.borders,
      typography: defaultTheme.typography,
      animation: defaultTheme.animation,
      keybindings: defaultTheme.keybindings,
      mode: themeMode,
    };

    if (!theme) return base;

    return {
      colors: { ...base.colors, ...theme.colors },
      spacing: { ...base.spacing, ...theme.spacing },
      sizing: { ...base.sizing, ...theme.sizing },
      borders: { ...base.borders, ...theme.borders },
      typography: { ...base.typography, ...theme.typography },
      animation: { ...base.animation, ...theme.animation },
      keybindings: { ...base.keybindings, ...theme.keybindings },
      mode: themeMode,
    };
  }, [theme, themeMode, modeColors]);

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

export function useThemeMode(): ThemeMode {
  return useTheme().mode;
}

// Re-export theme values for direct imports
export { colors, spacing, sizing, borders, typography, animation, keybindings };
export type { ThemeMode };
