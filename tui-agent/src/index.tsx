#!/usr/bin/env bun
import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { Command } from 'commander';
import React from 'react';
import { App } from './app.js';

// Initialize tools
import './tools/index.js';

const program = new Command();

program
  .name('oci-tui')
  .description('GPU-accelerated TUI for OCI GenAI agentic interactions')
  .version('0.0.1')
  .option('-c, --continue', 'Continue the most recent session')
  .option('-s, --session <id>', 'Resume a specific session by ID')
  .option('-m, --model <model>', 'Model to use (default: meta.llama-3.3-70b-instruct)')
  .option('-r, --region <region>', 'OCI region (default: eu-frankfurt-1)')
  .option('-t, --temperature <temp>', 'Temperature (0-2)', parseFloat)
  .action(async (options) => {
    try {
      // Create the renderer
      const renderer = await createCliRenderer();

      // Create the root and render
      const root = createRoot(renderer);
      root.render(
        <App
          continueSession={options.continue}
          sessionId={options.session}
          model={options.model}
          region={options.region}
          temperature={options.temperature}
        />
      );
    } catch (error) {
      console.error('Failed to start TUI:', error);
      process.exit(1);
    }
  });

program.parse();
