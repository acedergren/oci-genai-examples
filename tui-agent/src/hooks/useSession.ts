import { useCallback, useEffect } from 'react';
import { useConfigStore, useChatStore, useAgentStore } from '../state/index.js';
import {
  initPersistence,
  createSession,
  resumeSession,
  listSessions,
  addTurn,
  updateTurn,
  updateSessionTitle,
  type Session,
} from '../services/index.js';

export interface UseSessionOptions {
  /** Resume the most recent session */
  continueSession?: boolean;
  /** Specific session ID to resume */
  sessionId?: string;
  /** Model to use for new sessions */
  model?: string;
  /** Region for new sessions */
  region?: string;
}

export function useSession(options: UseSessionOptions = {}) {
  const setSessionId = useConfigStore((s) => s.setSessionId);
  const sessionId = useConfigStore((s) => s.sessionId);
  const setModel = useConfigStore((s) => s.setModel);
  const setRegion = useConfigStore((s) => s.setRegion);
  const model = useConfigStore((s) => s.model);
  const region = useConfigStore((s) => s.region);

  const addMessage = useChatStore((s) => s.addMessage);
  const clearMessages = useChatStore((s) => s.clearMessages);

  const reset = useAgentStore((s) => s.reset);

  // Initialize on mount
  useEffect(() => {
    initPersistence();

    if (options.model) setModel(options.model);
    if (options.region) setRegion(options.region);

    // Handle session continuation
    if (options.sessionId) {
      // Resume specific session
      const restored = resumeSession(options.sessionId);
      if (restored) {
        setSessionId(restored.session.id);
        setModel(restored.session.model);
        setRegion(restored.session.region);

        // Restore messages
        for (const turn of restored.turns) {
          addMessage({
            role: 'user',
            content: turn.userMessage.content,
            timestamp: turn.createdAt,
          });
          if (turn.assistantResponse) {
            addMessage({
              role: 'assistant',
              content: turn.assistantResponse.content,
              timestamp: turn.createdAt,
            });
          }
        }
      }
    } else if (options.continueSession) {
      // Resume most recent session
      const sessions = listSessions(1);
      if (sessions.length > 0) {
        const restored = resumeSession(sessions[0].id);
        if (restored) {
          setSessionId(restored.session.id);
          setModel(restored.session.model);
          setRegion(restored.session.region);

          // Restore messages
          for (const turn of restored.turns) {
            addMessage({
              role: 'user',
              content: turn.userMessage.content,
              timestamp: turn.createdAt,
            });
            if (turn.assistantResponse) {
              addMessage({
                role: 'assistant',
                content: turn.assistantResponse.content,
                timestamp: turn.createdAt,
              });
            }
          }
        }
      }
    }
  }, [options.sessionId, options.continueSession, options.model, options.region, setSessionId, setModel, setRegion, addMessage]);

  // Create a new session
  const newSession = useCallback(() => {
    const session = createSession(model, region);
    setSessionId(session.id);
    clearMessages();
    reset();
    return session;
  }, [model, region, setSessionId, clearMessages, reset]);

  // Ensure session exists before recording turns
  const ensureSession = useCallback((): string => {
    if (sessionId) return sessionId;
    const session = newSession();
    return session.id;
  }, [sessionId, newSession]);

  // Record a turn
  const recordTurn = useCallback(
    (turnNumber: number, userContent: string) => {
      const sid = ensureSession();
      return addTurn(sid, turnNumber, {
        role: 'user',
        content: userContent,
      });
    },
    [ensureSession]
  );

  // Update turn with response
  const completeTurn = useCallback(
    (turnId: string, assistantContent: string, tokensUsed?: number, costUsd?: number) => {
      return updateTurn(
        turnId,
        { role: 'assistant', content: assistantContent },
        tokensUsed,
        costUsd
      );
    },
    []
  );

  // Set session title (usually from first message)
  const setTitle = useCallback(
    (title: string) => {
      if (sessionId) {
        updateSessionTitle(sessionId, title);
      }
    },
    [sessionId]
  );

  // List available sessions
  const getSessions = useCallback((limit: number = 10): Session[] => {
    return listSessions(limit);
  }, []);

  // Switch to a different session
  const switchSession = useCallback(
    (targetSessionId: string) => {
      const restored = resumeSession(targetSessionId);
      if (restored) {
        setSessionId(restored.session.id);
        setModel(restored.session.model);
        setRegion(restored.session.region);
        clearMessages();
        reset();

        // Restore messages
        for (const turn of restored.turns) {
          addMessage({
            role: 'user',
            content: turn.userMessage.content,
            timestamp: turn.createdAt,
          });
          if (turn.assistantResponse) {
            addMessage({
              role: 'assistant',
              content: turn.assistantResponse.content,
              timestamp: turn.createdAt,
            });
          }
        }

        return true;
      }
      return false;
    },
    [setSessionId, setModel, setRegion, clearMessages, reset, addMessage]
  );

  return {
    sessionId,
    newSession,
    recordTurn,
    completeTurn,
    setTitle,
    getSessions,
    switchSession,
  };
}
