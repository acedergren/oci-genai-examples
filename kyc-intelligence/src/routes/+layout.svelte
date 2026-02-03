<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

<div class="min-h-screen">
  <!-- Header -->
  <header class="border-b border-white/10 backdrop-blur-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center bio-glow-cyan">
            <span class="text-2xl">🔮</span>
          </div>
          <h1 class="text-2xl font-bold text-glow-cyan">KYC Intelligence</h1>
        </div>
        <nav class="flex gap-6">
          <a href="/" class="text-gray-300 hover:text-cyan-400 transition-colors">Dashboard</a>
          <a href="/segments" class="text-gray-300 hover:text-cyan-400 transition-colors">Segments</a>
          <a href="/customers" class="text-gray-300 hover:text-cyan-400 transition-colors">Customers</a>
        </nav>
      </div>
    </div>
  </header>

  <!-- Main content -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {@render children()}
  </main>
</div>
