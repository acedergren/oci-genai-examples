import type { Cookies } from '@sveltejs/kit';
import { v4 as uuidv4 } from 'uuid';
import { getRepository } from './db.js';

const SESSION_COOKIE = 'oci_chat_session';
const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

export interface SessionContext {
  sessionId: string;
  isNew: boolean;
}

/**
 * Get or create a session from cookies.
 * Returns the session ID and whether it was newly created.
 */
export function getOrCreateSession(
  cookies: Cookies,
  options: { model: string; region: string }
): SessionContext {
  const repository = getRepository();
  const existingId = cookies.get(SESSION_COOKIE);

  // Try to use existing session
  if (existingId) {
    const session = repository.getSession(existingId);
    if (session && session.status === 'active') {
      return { sessionId: existingId, isNew: false };
    }
  }

  // Create new session
  const session = repository.createSession({
    id: uuidv4(),
    model: options.model,
    region: options.region,
    status: 'active',
  });

  cookies.set(SESSION_COOKIE, session.id, COOKIE_OPTIONS);
  return { sessionId: session.id, isNew: true };
}

/**
 * Start a new session, replacing any existing one.
 */
export function startNewSession(
  cookies: Cookies,
  options: { model: string; region: string }
): SessionContext {
  const repository = getRepository();

  // Mark old session as completed if exists
  const oldId = cookies.get(SESSION_COOKIE);
  if (oldId) {
    try {
      repository.updateSession(oldId, { status: 'completed' });
    } catch {
      // Old session may not exist, that's fine
    }
  }

  // Create new session
  const session = repository.createSession({
    id: uuidv4(),
    model: options.model,
    region: options.region,
    status: 'active',
  });

  cookies.set(SESSION_COOKIE, session.id, COOKIE_OPTIONS);
  return { sessionId: session.id, isNew: true };
}

/**
 * Switch to a specific session (for "continue" functionality).
 */
export function switchToSession(cookies: Cookies, sessionId: string): boolean {
  const repository = getRepository();
  const session = repository.getSession(sessionId);

  if (!session) {
    return false;
  }

  // Reactivate if completed
  if (session.status === 'completed') {
    repository.updateSession(sessionId, { status: 'active' });
  }

  cookies.set(SESSION_COOKIE, sessionId, COOKIE_OPTIONS);
  return true;
}

/**
 * Get current session ID from cookies (without creating).
 */
export function getCurrentSessionId(cookies: Cookies): string | undefined {
  return cookies.get(SESSION_COOKIE);
}
