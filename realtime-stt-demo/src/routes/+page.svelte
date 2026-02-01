<script lang="ts">
  import { onMount } from 'svelte';
  import TranscriptionDisplay from '$lib/TranscriptionDisplay.svelte';
  import { AudioCapture, isAudioCaptureSupported } from '$lib/AudioCapture';
  import type { RealtimeTranscriptionResult } from '@acedergren/oci-genai-provider';

  // State
  let isSupported = $state(false);
  let isRecording = $state(false);
  let isConnecting = $state(false);
  let error = $state<string | null>(null);
  let selectedLanguage = $state('en-US');
  let selectedModel = $state<'ORACLE' | 'WHISPER'>('ORACLE');
  let showPartials = $state(true);

  // Transcription results
  interface TranscriptionItem {
    text: string;
    isFinal: boolean;
    confidence: number;
    timestamp: number;
  }
  let transcriptions = $state<TranscriptionItem[]>([]);

  // Audio capture instance
  let audioCapture: AudioCapture | null = null;

  // Language options
  const languages = [
    { value: 'en-US', label: 'English (US)' },
    { value: 'en-GB', label: 'English (UK)' },
    { value: 'es-ES', label: 'Spanish' },
    { value: 'fr-FR', label: 'French' },
    { value: 'de-DE', label: 'German' },
    { value: 'it-IT', label: 'Italian' },
    { value: 'pt-BR', label: 'Portuguese (Brazil)' },
    { value: 'hi-IN', label: 'Hindi' },
    { value: 'auto', label: 'Auto-detect (Whisper)' },
  ];

  onMount(() => {
    isSupported = isAudioCaptureSupported();
    return () => {
      stopRecording();
    };
  });

  async function startRecording(): Promise<void> {
    if (isRecording) return;

    error = null;
    isConnecting = true;

    try {
      // For this demo, we'll simulate the transcription
      // In a real app, you would connect to OCI via a backend API
      // that handles the WebSocket connection server-side

      // Create audio capture
      audioCapture = new AudioCapture({
        sampleRate: 16000,
        onAudioData: handleAudioData,
        onError: (err) => {
          error = err.message;
          stopRecording();
        },
      });

      await audioCapture.start();
      isRecording = true;
      isConnecting = false;

      // Simulated connection message
      addTranscription({
        text: '[Connected - Start speaking...]',
        isFinal: true,
        confidence: 1.0,
        timestamp: Date.now(),
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to start recording';
      isConnecting = false;
    }
  }

  function stopRecording(): void {
    if (audioCapture) {
      audioCapture.stop();
      audioCapture = null;
    }
    isRecording = false;
    isConnecting = false;
  }

  function handleAudioData(data: Uint8Array): void {
    // In a real implementation, you would:
    // 1. Send this data to your backend via WebSocket or fetch
    // 2. The backend would forward to OCI realtime service
    // 3. Results would be streamed back

    // For demo purposes, we'll simulate occasional partial/final results
    simulateTranscriptionResult(data);
  }

  // Simulation for demo purposes
  let audioChunkCount = 0;
  const demoTexts = [
    'Hello',
    'Hello, this is',
    'Hello, this is a demo',
    'Hello, this is a demo of realtime',
    'Hello, this is a demo of realtime transcription.',
    'The audio',
    'The audio is being',
    'The audio is being captured',
    'The audio is being captured and processed.',
  ];
  let currentIndex = 0;

  function simulateTranscriptionResult(_data: Uint8Array): void {
    audioChunkCount++;

    // Simulate results every ~20 chunks (about 1 second at 16kHz)
    if (audioChunkCount % 20 === 0 && currentIndex < demoTexts.length) {
      const text = demoTexts[currentIndex];
      const isFinal = text.endsWith('.');

      if (showPartials || isFinal) {
        // Remove previous partial if this is an update
        if (!isFinal && transcriptions.length > 0) {
          const lastItem = transcriptions[transcriptions.length - 1];
          if (!lastItem.isFinal && lastItem.text.startsWith('[') === false) {
            transcriptions = transcriptions.slice(0, -1);
          }
        }

        addTranscription({
          text,
          isFinal,
          confidence: 0.85 + Math.random() * 0.15,
          timestamp: Date.now(),
        });
      }

      currentIndex++;
      if (currentIndex >= demoTexts.length) {
        currentIndex = 0;
        audioChunkCount = 0;
      }
    }
  }

  function addTranscription(item: TranscriptionItem): void {
    transcriptions = [...transcriptions, item];
  }

  function handleResult(result: RealtimeTranscriptionResult): void {
    if (!showPartials && !result.isFinal) return;

    addTranscription({
      text: result.text,
      isFinal: result.isFinal,
      confidence: result.confidence,
      timestamp: Date.now(),
    });
  }
</script>

<svelte:head>
  <title>OCI Realtime Speech-to-Text Demo</title>
</svelte:head>

<div class="min-h-screen flex flex-col">
  <!-- Header -->
  <header class="bg-white border-b border-slate-200 px-6 py-4">
    <div class="max-w-4xl mx-auto flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-slate-800">OCI Realtime STT Demo</h1>
        <p class="text-sm text-slate-500">Real-time speech transcription powered by Oracle Cloud</p>
      </div>
      <div class="flex items-center gap-4">
        <!-- Language selector -->
        <label class="flex items-center gap-2">
          <span class="text-sm text-slate-600">Language:</span>
          <select
            bind:value={selectedLanguage}
            disabled={isRecording}
            class="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white disabled:opacity-50"
          >
            {#each languages as lang}
              <option value={lang.value}>{lang.label}</option>
            {/each}
          </select>
        </label>

        <!-- Model selector -->
        <label class="flex items-center gap-2">
          <span class="text-sm text-slate-600">Model:</span>
          <select
            bind:value={selectedModel}
            disabled={isRecording}
            class="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white disabled:opacity-50"
          >
            <option value="ORACLE">Oracle</option>
            <option value="WHISPER">Whisper</option>
          </select>
        </label>
      </div>
    </div>
  </header>

  <!-- Main content -->
  <main class="flex-1 p-6">
    <div class="max-w-4xl mx-auto h-full flex flex-col gap-6">
      <!-- Error message -->
      {#if error}
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p class="font-medium">Error</p>
          <p class="text-sm">{error}</p>
        </div>
      {/if}

      <!-- Not supported message -->
      {#if !isSupported}
        <div class="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg">
          <p class="font-medium">Browser Not Supported</p>
          <p class="text-sm">
            Your browser doesn't support audio capture. Please use a modern browser like Chrome,
            Firefox, or Safari.
          </p>
        </div>
      {/if}

      <!-- Controls -->
      <div class="flex items-center justify-center gap-4">
        <!-- Record button -->
        <button
          onclick={isRecording ? stopRecording : startRecording}
          disabled={!isSupported || isConnecting}
          class="relative px-8 py-4 rounded-full font-semibold text-white transition-all
            {isRecording
            ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30'
            : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/30'}
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if isConnecting}
            <span class="flex items-center gap-2">
              <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                  fill="none"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                ></path>
              </svg>
              Connecting...
            </span>
          {:else if isRecording}
            <span class="flex items-center gap-2">
              <span class="w-3 h-3 bg-white rounded-full animate-pulse"></span>
              Stop Recording
            </span>
          {:else}
            Start Recording
          {/if}

          <!-- Pulsing ring when recording -->
          {#if isRecording}
            <span
              class="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-30"
            ></span>
          {/if}
        </button>

        <!-- Show partials toggle -->
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" bind:checked={showPartials} class="w-4 h-4 rounded" />
          <span class="text-slate-600">Show partial results</span>
        </label>
      </div>

      <!-- Transcription display -->
      <div class="flex-1 min-h-[400px]">
        <TranscriptionDisplay bind:transcriptions />
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="bg-white border-t border-slate-200 px-6 py-4">
    <div class="max-w-4xl mx-auto text-center text-sm text-slate-500">
      <p>
        This demo simulates realtime transcription. In production, connect to OCI Speech via a
        backend service.
      </p>
      <p class="mt-1">
        <a
          href="https://docs.oracle.com/iaas/Content/speech/using/overview.htm"
          class="text-blue-600 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          OCI Speech Documentation
        </a>
      </p>
    </div>
  </footer>
</div>
