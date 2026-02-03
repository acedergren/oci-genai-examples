import { useEffect, useCallback } from 'react';
import { useKeyboard as useOpenTUIKeyboard } from '@opentui/react';
import { usePanelStore, useAgentStore, useConfigStore } from '../state/index.js';
import { useKeybindings } from '../theme/index.js';

export interface KeyboardCallbacks {
  onSendMessage?: () => void;
  onNewSession?: () => void;
  onResumeSession?: () => void;
  onExit?: () => void;
  onHelp?: () => void;
}

export function useKeyboardShortcuts(callbacks: KeyboardCallbacks = {}) {
  const keybindings = useKeybindings();
  const toggleThought = usePanelStore((s) => s.toggleThought);
  const toggleReasoning = usePanelStore((s) => s.toggleReasoning);
  const toggleTools = usePanelStore((s) => s.toggleTools);
  const toggleSessions = usePanelStore((s) => s.toggleSessions);
  const toggleTheme = useConfigStore((s) => s.toggleTheme);
  const toggleModelPicker = useConfigStore((s) => s.toggleModelPicker);
  const modelPickerOpen = useConfigStore((s) => s.modelPickerOpen);
  const pendingApproval = useAgentStore((s) => s.pendingApproval);

  // Handle key presses
  const handleKey = useCallback(
    (key: { name?: string; ctrl?: boolean; shift?: boolean }) => {
      // Panel toggles
      if (key.name === keybindings.toggleThought && !key.ctrl) {
        toggleThought();
        return;
      }
      if (key.name === keybindings.toggleReasoning && !key.ctrl) {
        toggleReasoning();
        return;
      }
      if (key.name === keybindings.toggleTools && !key.ctrl) {
        toggleTools();
        return;
      }
      if (key.name === keybindings.toggleSessions && !key.ctrl) {
        toggleSessions();
        return;
      }

      // Theme toggle (Shift+T)
      if (key.name === keybindings.toggleTheme && key.shift) {
        toggleTheme();
        return;
      }

      // Model picker toggle (m) - only if model picker not already open
      if (key.name === keybindings.toggleModel && !key.ctrl && !modelPickerOpen) {
        toggleModelPicker();
        return;
      }

      // Help
      if (key.name === keybindings.help) {
        callbacks.onHelp?.();
        return;
      }

      // Ctrl shortcuts
      if (key.ctrl) {
        if (key.name === 'n') {
          callbacks.onNewSession?.();
          return;
        }
        if (key.name === 'r') {
          callbacks.onResumeSession?.();
          return;
        }
        if (key.name === 'c') {
          callbacks.onExit?.();
          return;
        }
      }
    },
    [
      keybindings,
      toggleThought,
      toggleReasoning,
      toggleTools,
      toggleSessions,
      toggleTheme,
      toggleModelPicker,
      modelPickerOpen,
      callbacks,
    ]
  );

  // Use OpenTUI's keyboard hook
  useOpenTUIKeyboard(handleKey);

  return {
    toggleThought,
    toggleReasoning,
    toggleTools,
    toggleSessions,
    toggleTheme,
    toggleModelPicker,
  };
}

/**
 * Hook for tool approval keyboard handling
 */
export function useToolApprovalKeys(
  onApprove: () => void,
  onReject: () => void
) {
  const keybindings = useKeybindings();
  const pendingApproval = useAgentStore((s) => s.pendingApproval);

  const handleKey = useCallback(
    (key: { name?: string }) => {
      if (!pendingApproval) return;

      if (key.name === keybindings.approve) {
        onApprove();
      } else if (key.name === keybindings.reject) {
        onReject();
      }
    },
    [pendingApproval, keybindings, onApprove, onReject]
  );

  useOpenTUIKeyboard(handleKey);
}
