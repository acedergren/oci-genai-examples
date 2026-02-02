import { create } from 'zustand';
import type { ToolExecution } from '../components/panels/index.js';
import type { ReasoningStep } from '../components/panels/index.js';

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'streaming' | 'error';

export interface AgentState {
  // Status
  status: AgentStatus;
  setStatus: (status: AgentStatus) => void;

  // Current thinking/reasoning
  currentThought: string | undefined;
  setCurrentThought: (thought: string | undefined) => void;

  // Reasoning chain
  reasoningSteps: ReasoningStep[];
  addReasoningStep: (step: Omit<ReasoningStep, 'id'>) => void;
  clearReasoningSteps: () => void;

  // Tool executions
  toolExecutions: ToolExecution[];
  addToolExecution: (tool: ToolExecution) => void;
  updateToolExecution: (id: string, updates: Partial<ToolExecution>) => void;
  clearToolExecutions: () => void;

  // Pending approval
  pendingApproval: ToolExecution | undefined;
  setPendingApproval: (tool: ToolExecution | undefined) => void;

  // Error state
  lastError: string | undefined;
  setLastError: (error: string | undefined) => void;

  // Reset all
  reset: () => void;
}

let stepCounter = 0;

export const useAgentStore = create<AgentState>((set) => ({
  // Initial state
  status: 'idle',
  currentThought: undefined,
  reasoningSteps: [],
  toolExecutions: [],
  pendingApproval: undefined,
  lastError: undefined,

  // Actions
  setStatus: (status) => set({ status }),

  setCurrentThought: (currentThought) => set({ currentThought }),

  addReasoningStep: (step) =>
    set((state) => ({
      reasoningSteps: [
        ...state.reasoningSteps,
        { ...step, id: `step-${++stepCounter}` },
      ],
    })),

  clearReasoningSteps: () => set({ reasoningSteps: [] }),

  addToolExecution: (tool) =>
    set((state) => ({
      toolExecutions: [...state.toolExecutions, tool],
    })),

  updateToolExecution: (id, updates) =>
    set((state) => ({
      toolExecutions: state.toolExecutions.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),

  clearToolExecutions: () => set({ toolExecutions: [] }),

  setPendingApproval: (pendingApproval) => set({ pendingApproval }),

  setLastError: (lastError) => set({ lastError }),

  reset: () =>
    set({
      status: 'idle',
      currentThought: undefined,
      reasoningSteps: [],
      toolExecutions: [],
      pendingApproval: undefined,
      lastError: undefined,
    }),
}));
