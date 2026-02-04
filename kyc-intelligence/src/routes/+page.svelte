<script lang="ts">
  import { onMount } from 'svelte';

  let stats = $state({
    totalCustomers: 0,
    customersWithEmbeddings: 0,
    activeSegments: 0,
    lastSegmentation: null as string | null,
  });

  let segments = $state<Array<{
    id: string;
    name: string;
    description: string;
    member_count: number;
    risk_profile: string;
    avg_customer_value: number;
    characteristics: string;
  }>>([]);

  let loading = $state(true);
  let segmenting = $state(false);
  let sortBy = $state<'size' | 'income' | 'risk'>('size');

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    try {
      const [statsRes, segmentsRes] = await Promise.all([
        fetch('/api/intelligence/stats'),
        fetch('/api/intelligence/segments'),
      ]);

      stats = await statsRes.json();
      segments = await segmentsRes.json();
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      loading = false;
    }
  }

  async function runSegmentation() {
    if (segmenting) return;

    segmenting = true;
    try {
      const response = await fetch('/api/intelligence/segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numSegments: 5 }),
      });

      if (!response.ok) {
        throw new Error('Segmentation failed');
      }

      await loadData();
    } catch (error) {
      console.error('Segmentation error:', error);
      alert('Segmentation failed. Check console for details.');
    } finally {
      segmenting = false;
    }
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  function getRiskBadgeClass(risk: string): string {
    switch (risk) {
      case 'low': return 'badge-success';
      case 'medium': return 'badge-warning';
      case 'high': return 'badge-error';
      case 'critical': return 'badge-error';
      default: return 'badge-neutral';
    }
  }

  function parseCharacteristics(json: string) {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function getSortedSegments() {
    const sorted = [...segments];
    switch (sortBy) {
      case 'size':
        return sorted.sort((a, b) => b.member_count - a.member_count);
      case 'income':
        return sorted.sort((a, b) => b.avg_customer_value - a.avg_customer_value);
      case 'risk':
        return sorted.sort((a, b) => {
          const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return riskOrder[a.risk_profile as keyof typeof riskOrder] - riskOrder[b.risk_profile as keyof typeof riskOrder];
        });
      default:
        return sorted;
    }
  }

  function getEmbeddingCoverage(): number {
    return stats.totalCustomers > 0
      ? (stats.customersWithEmbeddings / stats.totalCustomers) * 100
      : 0;
  }
</script>

<div class="container-enterprise" style="padding-block: var(--space-lg);">
  <!-- Enterprise Page Header -->
  <div class="page-header">
    <div>
      <h1 class="page-title">Customer Intelligence</h1>
      <p class="page-subtitle">
        AI-powered segmentation using OCI GenAI embeddings and k-means clustering
      </p>
    </div>

    <div class="flex gap-3">
      {#if segments.length > 0}
        <button class="btn btn-secondary" onclick={() => loadData()}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
          </svg>
          Refresh
        </button>
      {/if}
    </div>
  </div>

  <!-- Key Metrics Grid -->
  <div class="grid-stats" style="margin-block-end: var(--space-lg);">
    <article class="enterprise-card stat-card p-6 animate-fade-in">
      <div class="flex items-center justify-between gap-4">
        <div class="flex-1 min-w-0">
          <div class="metric-label">Total Customers</div>
          {#if loading}
            <div class="skeleton h-10 w-24 mt-2"></div>
          {:else}
            <div class="metric-value stat-value text-accent-cyan">
              {formatNumber(stats.totalCustomers)}
            </div>
          {/if}
        </div>
        <div class="stat-icon text-accent-cyan opacity-20">👥</div>
      </div>
    </article>

    <article class="enterprise-card stat-card p-6 animate-fade-in" style="animation-delay: 50ms;">
      <div class="flex items-center justify-between gap-4">
        <div class="flex-1 min-w-0">
          <div class="metric-label">Embedding Coverage</div>
          {#if loading}
            <div class="skeleton h-10 w-24 mt-2"></div>
          {:else}
            <div class="metric-value stat-value text-accent-purple">
              {getEmbeddingCoverage().toFixed(1)}%
            </div>
            <div class="progress-bar mt-3">
              <div class="progress-fill" style="width: {getEmbeddingCoverage()}%"></div>
            </div>
          {/if}
        </div>
        <div class="stat-icon text-accent-purple opacity-20">🧬</div>
      </div>
    </article>

    <article class="enterprise-card stat-card p-6 animate-fade-in" style="animation-delay: 100ms;">
      <div class="flex items-center justify-between gap-4">
        <div class="flex-1 min-w-0">
          <div class="metric-label">Active Segments</div>
          {#if loading}
            <div class="skeleton h-10 w-24 mt-2"></div>
          {:else}
            <div class="metric-value stat-value text-accent-pink">
              {stats.activeSegments}
            </div>
          {/if}
        </div>
        <div class="stat-icon text-accent-pink opacity-20">📊</div>
      </div>
    </article>

    <article class="enterprise-card stat-card p-6 animate-fade-in" style="animation-delay: 150ms;">
      <div class="flex items-center justify-between gap-4">
        <div class="flex-1 min-w-0">
          <div class="metric-label">Last Updated</div>
          {#if loading}
            <div class="skeleton h-8 w-32 mt-2"></div>
          {:else}
            <div class="text-fluid-base font-semibold text-secondary mt-2">
              {stats.lastSegmentation || 'Never'}
            </div>
          {/if}
        </div>
        <div class="stat-icon text-secondary opacity-20">⏰</div>
      </div>
    </article>
  </div>

  <!-- Action Panel -->
  <div class="enterprise-card enterprise-card-elevated p-6 md:p-8 animate-fade-in" style="margin-block-end: var(--space-lg); animation-delay: 200ms;">
    <div class="flex flex-col md:flex-row items-start md:items-center gap-6">
      <div class="flex-1">
        <h2 class="text-fluid-xl font-bold text-primary mb-2">Run Customer Segmentation</h2>
        <p class="text-fluid-sm text-secondary">
          Analyze {formatNumber(stats.customersWithEmbeddings)} customer profiles using k-means clustering on 1024-dimensional embeddings from OCI GenAI.
        </p>
      </div>

      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
        {#if stats.customersWithEmbeddings > 0}
          <div class="badge badge-success">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Ready
          </div>
        {/if}

        <button
          class="btn btn-primary whitespace-nowrap"
          onclick={runSegmentation}
          disabled={segmenting || loading}
        >
          {#if segmenting}
            <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <span>Clustering...</span>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="10 8 16 12 10 16 10 8"/>
            </svg>
            <span>Run Segmentation</span>
          {/if}
        </button>
      </div>
    </div>

    {#if segmenting}
      <div class="mt-4">
        <div class="progress-bar">
          <div class="progress-fill" style="width: 100%; animation: progress 2s ease-in-out infinite;"></div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Segments Section -->
  {#if segments.length > 0}
    <div class="animate-fade-in" style="animation-delay: 250ms;">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 class="text-fluid-2xl font-bold text-primary">Customer Segments</h2>
          <p class="text-fluid-sm text-tertiary mt-1">
            {formatNumber(segments.reduce((sum, s) => sum + s.member_count, 0))} customers across {segments.length} segments
          </p>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-fluid-xs text-tertiary">Sort by:</span>
          <div class="flex gap-2">
            <button
              class="btn {sortBy === 'size' ? 'btn-secondary' : 'btn-ghost'}"
              onclick={() => sortBy = 'size'}
            >
              Size
            </button>
            <button
              class="btn {sortBy === 'income' ? 'btn-secondary' : 'btn-ghost'}"
              onclick={() => sortBy = 'income'}
            >
              Income
            </button>
            <button
              class="btn {sortBy === 'risk' ? 'btn-secondary' : 'btn-ghost'}"
              onclick={() => sortBy = 'risk'}
            >
              Risk
            </button>
          </div>
        </div>
      </div>

      <div class="grid-auto">
        {#each getSortedSegments() as segment, i}
          {@const chars = parseCharacteristics(segment.characteristics)}
          <article class="enterprise-card segment-card p-6 animate-fade-in" style="animation-delay: {300 + i * 50}ms;">
            <div class="space-y-4">
              <!-- Header -->
              <div class="segment-card-header">
                <div class="flex-1 min-w-0">
                  <h3 class="text-fluid-xl font-bold text-accent-purple mb-3">
                    {segment.name}
                  </h3>
                  <div class="flex flex-wrap gap-2">
                    <span class="badge badge-primary">
                      {formatNumber(segment.member_count)} customers
                    </span>
                    <span class="badge {getRiskBadgeClass(segment.risk_profile)}">
                      {segment.risk_profile || 'Unknown'} risk
                    </span>
                  </div>
                </div>
              </div>

              <!-- Description -->
              <p class="text-fluid-sm text-secondary leading-relaxed">
                {segment.description}
              </p>

              <!-- Key Financial Metrics -->
              {#if chars}
                <div class="grid grid-cols-2 gap-4 pt-4 border-t" style="border-color: var(--color-border);">
                  <div class="metric">
                    <div class="metric-label">Avg Income</div>
                    <div class="metric-value text-fluid-lg text-accent-cyan">
                      {formatCurrency(chars.avgIncome || segment.avg_customer_value)}
                    </div>
                  </div>
                  {#if chars.avgNetWorth}
                    <div class="metric">
                      <div class="metric-label">Avg Net Worth</div>
                      <div class="metric-value text-fluid-lg text-accent-purple">
                        {formatCurrency(chars.avgNetWorth)}
                      </div>
                    </div>
                  {/if}
                </div>

                {#if chars.incomeRange}
                  <div class="pt-2">
                    <div class="metric-label mb-1">Income Range</div>
                    <div class="text-fluid-sm text-secondary">{chars.incomeRange}</div>
                  </div>
                {/if}

                <!-- Top Occupations -->
                {#if chars.commonOccupations && chars.commonOccupations.length > 0}
                  <div class="pt-4 border-t" style="border-color: var(--color-border);">
                    <div class="metric-label mb-3">Top Occupations</div>
                    <div class="flex flex-wrap gap-2">
                      {#each chars.commonOccupations.slice(0, 3) as occ}
                        <span class="badge badge-secondary">
                          {occ.occupation} <span class="text-muted">×{occ.count}</span>
                        </span>
                      {/each}
                    </div>
                  </div>
                {/if}

                <!-- Top Locations -->
                {#if chars.commonLocations && chars.commonLocations.length > 0}
                  <div class="pt-4 border-t" style="border-color: var(--color-border);">
                    <div class="metric-label mb-3">Geographic Distribution</div>
                    <div class="flex flex-wrap gap-2">
                      {#each chars.commonLocations.slice(0, 3) as loc}
                        <span class="badge badge-neutral">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                            <circle cx="12" cy="10" r="3"/>
                          </svg>
                          {loc.location.split(',')[0]} <span class="text-muted">×{loc.count}</span>
                        </span>
                      {/each}
                    </div>
                  </div>
                {/if}

                <!-- Risk & KYC Distribution -->
                {#if chars.riskDistribution || chars.kycStatusDistribution}
                  <div class="pt-4 border-t" style="border-color: var(--color-border);">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {#if chars.riskDistribution}
                        <div>
                          <div class="metric-label mb-2">Risk Profile</div>
                          <div class="space-y-2">
                            {#each Object.entries(chars.riskDistribution) as [risk, count]}
                              <div class="flex items-center justify-between gap-2 text-fluid-xs">
                                <span class="text-secondary capitalize">{risk}</span>
                                <div class="flex items-center gap-2 flex-1 max-w-[120px]">
                                  <div class="flex-1 h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                                    <div
                                      class="h-full rounded-full"
                                      style="width: {(count / segment.member_count) * 100}%; background: {risk === 'low' ? 'var(--color-success)' : risk === 'medium' ? 'var(--color-warning)' : 'var(--color-error)'};"
                                    ></div>
                                  </div>
                                  <span class="text-muted font-medium tabular-nums">{count}</span>
                                </div>
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/if}
              {/if}
            </div>
          </article>
        {/each}
      </div>
    </div>
  {:else if !loading}
    <!-- Empty State -->
    <div class="enterprise-card enterprise-card-elevated p-12 text-center animate-fade-in">
      <div class="text-6xl mb-6 opacity-20">🌊</div>
      <h3 class="text-fluid-2xl font-bold text-tertiary mb-3">No Segments Available</h3>
      <p class="text-fluid-base text-muted max-w-lg mx-auto mb-8">
        Run segmentation analysis to discover meaningful customer groups based on their profiles, behaviors, and characteristics.
      </p>
      <button
        class="btn btn-primary"
        onclick={runSegmentation}
        disabled={segmenting || stats.customersWithEmbeddings === 0}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polygon points="10 8 16 12 10 16 10 8"/>
        </svg>
        Run First Segmentation
      </button>
      {#if stats.customersWithEmbeddings === 0}
        <p class="text-fluid-sm text-warning mt-4">
          ⚠️ No embeddings found. Run <code class="px-2 py-1 bg-gray-800 rounded">pnpm generate-embeddings</code> first.
        </p>
      {/if}
    </div>
  {/if}

  <!-- Loading Skeleton -->
  {#if loading && segments.length === 0}
    <div class="grid-auto">
      {#each [1, 2, 3, 4] as i}
        <div class="enterprise-card p-6">
          <div class="skeleton h-8 w-3/4 mb-4"></div>
          <div class="skeleton h-4 w-full mb-2"></div>
          <div class="skeleton h-4 w-5/6 mb-4"></div>
          <div class="skeleton h-20 w-full"></div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  @keyframes progress {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }
</style>
