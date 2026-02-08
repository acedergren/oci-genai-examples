<script lang="ts">
	import { authClient } from '$lib/auth-client.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function signInWith(providerId: string) {
		authClient.signIn.oauth2({
			providerId,
			callbackURL: '/'
		});
	}

	function getProviderIcon(providerType: string): string {
		const icons: Record<string, string> = {
			idcs: '☁️',
			oidc: '🔐'
		};
		return icons[providerType] || '🔑';
	}
</script>

<div class="login-page">
	<div class="login-card panel-glass">
		<div class="login-logo">
			<div class="logo-diamond">&#9670;</div>
		</div>

		<h1 class="login-title">OCI Self-Service Portal</h1>
		<p class="login-subtitle">Cloud operations powered by AI</p>

		{#if data.idps.length === 0}
			<div class="no-idps">
				<p class="no-idps-message">No identity providers configured</p>
				<p class="no-idps-hint">Please contact your administrator</p>
			</div>
		{:else}
			<div class="idp-buttons">
				{#each data.idps as idp (idp.id)}
					<button class="btn btn-primary login-btn" onclick={() => signInWith(idp.providerId)}>
						<span class="btn-icon">{getProviderIcon(idp.providerType)}</span>
						Sign in with {idp.displayName}
					</button>
				{/each}
			</div>
		{/if}

		<p class="login-footer">Manage your Oracle Cloud resources with natural language.</p>
	</div>
</div>

<style>
	.login-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100dvh;
		padding: var(--space-lg);
	}

	.login-card {
		width: 100%;
		max-width: 400px;
		padding: var(--space-xxl) var(--space-xl);
		text-align: center;
	}

	.login-logo {
		margin-bottom: var(--space-lg);
	}

	.logo-diamond {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		font-size: 2rem;
		color: var(--accent-primary);
		background: var(--bg-elevated);
		border-radius: var(--radius-lg);
		animation: bioluminescent-pulse 3s ease-in-out infinite;
	}

	.login-title {
		font-size: var(--text-2xl);
		font-weight: 700;
		color: var(--fg-primary);
		margin-bottom: var(--space-xs);
	}

	.login-subtitle {
		font-size: var(--text-sm);
		color: var(--fg-secondary);
		margin-bottom: var(--space-xl);
	}

	.idp-buttons {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
	}

	.login-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		width: 100%;
		padding: var(--space-md) var(--space-lg);
		font-size: var(--text-base);
		font-weight: 600;
	}

	.btn-icon {
		font-size: 1.25rem;
	}

	.no-idps {
		padding: var(--space-xl);
		background: var(--bg-tertiary);
		border: 1px solid var(--border-muted);
		border-radius: var(--radius-md);
		text-align: center;
	}

	.no-idps-message {
		font-size: var(--text-base);
		font-weight: 600;
		color: var(--fg-secondary);
		margin-bottom: var(--space-xs);
	}

	.no-idps-hint {
		font-size: var(--text-sm);
		color: var(--fg-tertiary);
	}

	.login-footer {
		margin-top: var(--space-lg);
		font-size: var(--text-xs);
		color: var(--fg-tertiary);
	}
</style>
