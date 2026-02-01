<script lang="ts">
  /**
   * TranscriptionDisplay Component
   *
   * Displays transcription results with highlighting for partial vs final.
   */

  interface TranscriptionItem {
    text: string;
    isFinal: boolean;
    confidence: number;
    timestamp: number;
  }

  let { transcriptions = $bindable<TranscriptionItem[]>([]) } = $props();

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function formatConfidence(confidence: number): string {
    return `${Math.round(confidence * 100)}%`;
  }

  function getFullTranscript(): string {
    return transcriptions
      .filter((t) => t.isFinal)
      .map((t) => t.text)
      .join(' ');
  }

  async function copyToClipboard(): Promise<void> {
    const text = getFullTranscript();
    await navigator.clipboard.writeText(text);
  }

  function clear(): void {
    transcriptions = [];
  }

  // Auto-scroll to bottom when new items are added
  let container: HTMLElement;
  $effect(() => {
    if (container && transcriptions.length > 0) {
      container.scrollTop = container.scrollHeight;
    }
  });
</script>

<div class="flex flex-col h-full">
  <!-- Header with actions -->
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-lg font-semibold text-slate-700">Transcription</h2>
    <div class="flex gap-2">
      <button
        onclick={copyToClipboard}
        class="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
        disabled={transcriptions.length === 0}
      >
        Copy
      </button>
      <button
        onclick={clear}
        class="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
        disabled={transcriptions.length === 0}
      >
        Clear
      </button>
    </div>
  </div>

  <!-- Transcription list -->
  <div
    bind:this={container}
    class="flex-1 overflow-y-auto bg-white rounded-xl border border-slate-200 p-4 space-y-2"
  >
    {#if transcriptions.length === 0}
      <div class="text-center text-slate-400 py-8">
        <p>Start recording to see transcription results here.</p>
      </div>
    {:else}
      {#each transcriptions as item (item.timestamp)}
        <div
          class="p-3 rounded-lg transition-all duration-200 {item.isFinal
            ? 'bg-emerald-50 border border-emerald-200'
            : 'bg-amber-50 border border-amber-200 animate-pulse'}"
        >
          <div class="flex items-start gap-3">
            <!-- Status indicator -->
            <div class="flex-shrink-0 mt-1">
              {#if item.isFinal}
                <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
              {:else}
                <div class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
              {/if}
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <p
                class="text-slate-800 {item.isFinal ? 'font-medium' : 'font-normal text-slate-600'}"
              >
                {item.text}
              </p>
              <div class="mt-1 flex items-center gap-3 text-xs text-slate-500">
                <span>{formatTime(item.timestamp)}</span>
                <span>Confidence: {formatConfidence(item.confidence)}</span>
                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs {item.isFinal
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'}">
                  {item.isFinal ? 'Final' : 'Partial'}
                </span>
              </div>
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Stats -->
  {#if transcriptions.length > 0}
    <div class="mt-4 flex items-center justify-between text-sm text-slate-500">
      <span>
        {transcriptions.filter((t) => t.isFinal).length} final,
        {transcriptions.filter((t) => !t.isFinal).length} partial
      </span>
      <span>
        Total: {getFullTranscript().split(/\s+/).filter(Boolean).length} words
      </span>
    </div>
  {/if}
</div>
