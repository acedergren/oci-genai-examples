// Query key factories
export { queryKeys } from './keys';

// Query options factories (v5 pattern)
export {
	modelsQueryOptions,
	sessionsQueryOptions,
	sessionDetailQueryOptions,
	sessionUsageQueryOptions
} from './options';

// Fetcher functions
export {
	fetchModels,
	fetchSessions,
	fetchSessionDetail,
	fetchSessionUsage,
	createSession,
	deleteSession
} from './fetchers';

// Types
export type {
	OciModel,
	OciSession,
	SessionUsage,
	ChatMessage,
	ModelsResponse,
	SessionsResponse,
	SessionDetailResponse,
	FetcherOptions
} from './types';

// Query client utilities
export { createQueryClient, defaultQueryClientOptions } from './client';

// Svelte Query hooks
export {
	useModels,
	useSessions,
	useSessionDetail,
	useSessionUsage,
	useCreateSession,
	useDeleteSession,
	useInvalidateSessionUsage
} from './hooks';
