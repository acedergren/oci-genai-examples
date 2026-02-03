import { create } from 'zustand';
import type { PanelState } from '../components/panels/index.js';

export interface PanelStoreState {
  // Panel visibility
  panels: PanelState;
  toggleThought: () => void;
  toggleReasoning: () => void;
  toggleTools: () => void;
  toggleSessions: () => void;
  setPanelOpen: (panel: keyof PanelState, open: boolean) => void;

  // Side panel visibility
  sidePanelVisible: boolean;
  setSidePanelVisible: (visible: boolean) => void;
  toggleSidePanel: () => void;
}

export const usePanelStore = create<PanelStoreState>((set) => ({
  // Initial state - all panels collapsed, side panel visible
  panels: {
    thought: false,
    reasoning: false,
    tools: true, // Tools panel open by default
    sessions: false,
  },
  sidePanelVisible: true,

  // Actions
  toggleThought: () =>
    set((state) => ({
      panels: { ...state.panels, thought: !state.panels.thought },
    })),

  toggleReasoning: () =>
    set((state) => ({
      panels: { ...state.panels, reasoning: !state.panels.reasoning },
    })),

  toggleTools: () =>
    set((state) => ({
      panels: { ...state.panels, tools: !state.panels.tools },
    })),

  toggleSessions: () =>
    set((state) => ({
      panels: { ...state.panels, sessions: !state.panels.sessions },
    })),

  setPanelOpen: (panel, open) =>
    set((state) => ({
      panels: { ...state.panels, [panel]: open },
    })),

  setSidePanelVisible: (sidePanelVisible) => set({ sidePanelVisible }),

  toggleSidePanel: () =>
    set((state) => ({ sidePanelVisible: !state.sidePanelVisible })),
}));
