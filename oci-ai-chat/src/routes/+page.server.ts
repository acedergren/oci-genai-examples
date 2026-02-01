import type { PageServerLoad } from './$types';
import { getRepository } from '$lib/server/db.js';
import { getCurrentSessionId } from '$lib/server/session.js';

export const load: PageServerLoad = async ({ cookies }) => {
  const repository = getRepository();
  const currentSessionId = getCurrentSessionId(cookies);
  const sessions = repository.listSessions({ limit: 50 });

  const initialMessages = currentSessionId
    ? repository
        .getSessionTurns(currentSessionId)
        .flatMap(
          (turn) =>
            [
              turn.userMessage && {
                role: turn.userMessage.role,
                content: turn.userMessage.content,
              },
              turn.assistantResponse && {
                role: turn.assistantResponse.role,
                content: turn.assistantResponse.content,
              },
            ].filter(Boolean) as Array<{ role: string; content: string }>
        )
    : [];

  return {
    sessions,
    currentSessionId,
    initialMessages,
  };
};
