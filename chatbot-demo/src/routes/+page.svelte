<script lang="ts">
  import Chat from "$lib/components/chat/Chat.svelte";
  import { Button } from "$lib/components/ui/button";
  import Select from "$lib/components/Select.svelte";
  import { Github } from "lucide-svelte";

  const models = [
    { value: 'xai.grok-4', label: 'xAI Grok 4' },
    { value: 'meta.llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
    { value: 'google.gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'cohere.command-r-plus', label: 'Cohere Command R+' },
    { value: 'cohere.command-a-reasoning-08-2025', label: 'Command A Reasoning' },
  ];

  let selectedModel = $state('meta.llama-3.3-70b-instruct');
</script>

<div class="flex flex-col min-h-screen bg-background text-foreground">
  <header class="flex items-center justify-between px-6 py-4 border-b">
    <div class="flex items-center gap-2">
      <div class="h-8 w-8 rounded bg-[#FF0000] flex items-center justify-center text-white font-bold text-xl">
        AI
      </div>
      <h1 class="font-bold text-lg hidden sm:block">OCI Generative Inference</h1>
      <h1 class="font-bold text-lg sm:hidden">OCI AI</h1>
    </div>
    
    <div class="flex items-center gap-4">
      <Select options={models} bind:value={selectedModel} />
      
      <Button variant="ghost" size="icon" href="https://github.com/acedergren/oci-genai-provider" target="_blank">
        <Github class="h-5 w-5" />
        <span class="sr-only">GitHub</span>
      </Button>
    </div>
  </header>

  <main class="flex-1 flex flex-col overflow-hidden">
    <Chat class="flex-1" modelId={selectedModel} />
  </main>
</div>
