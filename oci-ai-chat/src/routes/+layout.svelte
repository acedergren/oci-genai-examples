<script lang="ts">
	import "../app.css";
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';

	// Create query client with OCI AI Chat defaults
	// Using QueryClient directly from svelte-query to avoid version mismatches
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 1000 * 60 * 5, // 5 minutes
				gcTime: 1000 * 60 * 60, // 1 hour (v5: renamed from cacheTime)
				retry: 1,
				refetchOnWindowFocus: false,
			},
		},
	});

	let { children } = $props();
</script>

<QueryClientProvider client={queryClient}>
	{@render children()}
</QueryClientProvider>
