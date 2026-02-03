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
  }>>([]);

  let loading = $state(true);
  let segmenting = $state(false);

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    try {
      // Fetch stats
      const statsRes = await fetch('/api/intelligence/stats');
      stats = await statsRes.json();

      // Fetch segments
      const segmentsRes = await fetch('/api/intelligence/segments');
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
</script>

<div class="space-y-8">
  <!-- Hero section -->
  <div class="text-center space-y-4">
    <h2 class="text-4xl font-bold text-glow-cyan">Customer Intelligence Dashboard</h2>
    <p class="text-gray-400 text-lg">AI-powered customer segmentation and insights</p>
  </div>

  <!-- Stats Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <div class="bio-card p-6">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-400">Total Customers</p>
          <p class="text-3xl font-bold text-glow-cyan">{loading ? '...' : stats.totalCustomers}</p>
        </div>
        <div class="text-4xl">👥</div>
      </div>
    </div>

    <div class="bio-card p-6">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-400">With Embeddings</p>
          <p class="text-3xl font-bold text-glow-purple">{loading ? '...' : stats.customersWithEmbeddings}</p>
        </div>
        <div class="text-4xl">🧬</div>
      </div>
    </div>

    <div class="bio-card p-6">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-400">Active Segments</p>
          <p class="text-3xl font-bold text-glow-pink">{loading ? '...' : stats.activeSegments}</p>
        </div>
        <div class="text-4xl">📊</div>
      </div>
    </div>

    <div class="bio-card p-6">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-400">Last Updated</p>
          <p class="text-sm font-semibold text-gray-300">
            {loading ? '...' : stats.lastSegmentation || 'Never'}
          </p>
        </div>
        <div class="text-4xl">⏰</div>
      </div>
    </div>
  </div>

  <!-- Action Section -->
  <div class="bio-card p-8 text-center space-y-4">
    <h3 class="text-2xl font-bold text-glow-purple">Run Customer Segmentation</h3>
    <p class="text-gray-400">
      Analyze customer profiles and create intelligent segments using AI-powered clustering
    </p>
    <button
      class="bio-button"
      onclick={runSegmentation}
      disabled={segmenting || loading}
    >
      {segmenting ? '🔄 Segmenting...' : '🚀 Run Segmentation'}
    </button>
  </div>

  <!-- Segments Display -->
  {#if segments.length > 0}
    <div class="space-y-4">
      <h3 class="text-2xl font-bold text-glow-cyan">Customer Segments</h3>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {#each segments as segment}
          <div class="bio-card p-6 space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="text-xl font-semibold text-glow-purple">{segment.name}</h4>
              <span class="text-sm px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400">
                {segment.member_count} customers
              </span>
            </div>
            <p class="text-gray-400 text-sm">{segment.description}</p>
            <div class="flex items-center gap-4 text-sm">
              <span class="flex items-center gap-2">
                <span class="text-gray-500">Risk:</span>
                <span class="font-semibold capitalize {
                  segment.risk_profile === 'low' ? 'text-green-400' :
                  segment.risk_profile === 'medium' ? 'text-yellow-400' :
                  'text-red-400'
                }">
                  {segment.risk_profile || 'Unknown'}
                </span>
              </span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else if !loading}
    <div class="bio-card p-12 text-center space-y-4">
      <div class="text-6xl">🌊</div>
      <h3 class="text-2xl font-bold text-gray-400">No Segments Yet</h3>
      <p class="text-gray-500">Run segmentation to discover customer insights</p>
    </div>
  {/if}
</div>
