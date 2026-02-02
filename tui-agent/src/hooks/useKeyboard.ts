import { useEffect, useCallback } from 'react';
import { useKeyboard as useOpenTUIKeyboard } from '@opentui/react';
import { usePanelStore, useAgentStore } from '../state/index.js';
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
      callbacks,
    ]
  );

  // Use OpenTUI's keyboard hook
  useOpenTUIKeyboard(handleKey);

  return {
    toggleThought,
    toggleReasoning,
    toggleTools,
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
