import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light';

export interface ConfigState {
  // Theme
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;

  // Model picker
  modelPickerOpen: boolean;
  setModelPickerOpen: (open: boolean) => void;
  toggleModelPicker: () => void;

  // Session
  sessionId: string | undefined;
  setSessionId: (id: string | undefined) => void;

  // Model configuration
  model: string;
  setModel: (model: string) => void;

  region: string;
  setRegion: (region: string) => void;

  compartmentId: string | undefined;
  setCompartmentId: (id: string | undefined) => void;

  // LLM parameters
  temperature: number;
  setTemperature: (temp: number) => void;

  maxTokens: number;
  setMaxTokens: (tokens: number) => void;

  // Session stats
  tokensUsed: number;
  addTokensUsed: (tokens: number) => void;
  resetTokensUsed: () => void;

  costUsd: number;
  addCostUsd: (cost: number) => void;
  resetCostUsd: () => void;

  // Reset all config
  reset: () => void;
}

const DEFAULT_MODEL = 'meta.llama-3.3-70b-instruct';
const DEFAULT_REGION = 'eu-frankfurt-1';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;

export const useConfigStore = create<ConfigState>((set) => ({
  // Initial state
  theme: 'dark',
  modelPickerOpen: false,
  sessionId: undefined,
  model: DEFAULT_MODEL,
  region: DEFAULT_REGION,
  compartmentId: process.env.OCI_COMPARTMENT_ID,
  temperature: DEFAULT_TEMPERATURE,
  maxTokens: DEFAULT_MAX_TOKENS,
  tokensUsed: 0,
  costUsd: 0,

  // Actions
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  setModelPickerOpen: (modelPickerOpen) => set({ modelPickerOpen }),
  toggleModelPicker: () => set((state) => ({ modelPickerOpen: !state.modelPickerOpen })),
  setSessionId: (sessionId) => set({ sessionId }),
  setModel: (model) => set({ model }),
  setRegion: (region) => set({ region }),
  setCompartmentId: (compartmentId) => set({ compartmentId }),
  setTemperature: (temperature) => set({ temperature }),
  setMaxTokens: (maxTokens) => set({ maxTokens }),

  addTokensUsed: (tokens) =>
    set((state) => ({ tokensUsed: state.tokensUsed + tokens })),

  resetTokensUsed: () => set({ tokensUsed: 0 }),

  addCostUsd: (cost) =>
    set((state) => ({ costUsd: state.costUsd + cost })),

  resetCostUsd: () => set({ costUsd: 0 }),

  reset: () =>
    set({
      sessionId: undefined,
      model: DEFAULT_MODEL,
      region: DEFAULT_REGION,
      temperature: DEFAULT_TEMPERATURE,
      maxTokens: DEFAULT_MAX_TOKENS,
      tokensUsed: 0,
      costUsd: 0,
    }),
}));
