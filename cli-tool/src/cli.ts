#!/usr/bin/env node
import {
  createOCI,
  isValidModelId,
  getModelMetadata,
  supportsReasoning,
} from '@acedergren/oci-genai-provider';
import { startTui } from './tui.js';
import { generateText, streamText, type LanguageModel, tool } from 'ai';
import { z } from 'zod';
import { execSync } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { pino } from 'pino';
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';

// Pricing per 1k tokens (USD) - Estimates Jan 2026
const PRICING: Record<string, { input: number; output: number }> = {
  'google.gemini-2.5-flash': { input: 0.0001, output: 0.0003 },
  'google.gemini-2.5-pro': { input: 0.00125, output: 0.00375 },
  'meta.llama-3.3-70b-instruct': { input: 0.0006, output: 0.0018 },
  'cohere.command-r-plus': { input: 0.003, output: 0.015 },
  'xai.grok-4': { input: 0.005, output: 0.015 },
};

interface SessionStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
}

const sessionStats: SessionStats = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCost: 0,
};

function calculateCost(modelId: string, input: number, output: number): number {
  const pricing = PRICING[modelId] || { input: 0.001, output: 0.002 };
  return (input / 1000) * pricing.input + (output / 1000) * pricing.output;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function renderTopBar() {
  process.stdout.write(
    chalk.bgRed.white.bold(' OCI Generative Inference '.padEnd(process.stdout.columns || 80)) + '\n'
  );
}

function renderStatusBar(opts: any, lastUsage?: any, lastText?: string, pinned = true) {
  const metadata = getModelMetadata(opts.model);
  const contextWindow = metadata?.contextWindow || 0;

  let input = 0;
  let output = 0;

  if (lastUsage) {
    input = lastUsage.inputTokens || lastUsage.usage?.inputTokens || 0;
    output = lastUsage.outputTokens || lastUsage.usage?.outputTokens || 0;
  }

  // Fallback if OCI returns 0
  if (output === 0 && lastText) {
    output = estimateTokens(lastText);
  }
  if (input === 0 && opts._lastPrompt) {
    input = estimateTokens(opts._lastPrompt);
  }

  sessionStats.totalInputTokens += input;
  sessionStats.totalOutputTokens += output;
  sessionStats.totalCost += calculateCost(opts.model, input, output);

  const totalTokens = sessionStats.totalInputTokens + sessionStats.totalOutputTokens;
  const contextLeft = contextWindow - (lastUsage?.totalTokens || input + output || 0);
  const contextPercent =
    contextWindow > 0 ? Math.round((Math.max(0, contextLeft) / contextWindow) * 100) : 0;

  const barParts = [
    chalk.bgBlue.white(` MODEL: ${opts.model} `),
    chalk.bgWhite.black(` REGION: ${opts.region} `),
    chalk.bgCyan.black(` COMP: ${opts.compartment.substring(0, 15)}... `),
    chalk.bgMagenta.white(` SESSION TOKENS: ${totalTokens} `),
    chalk.bgYellow.black(` SESSION COST: $${sessionStats.totalCost.toFixed(6)} `),
    contextWindow > 0 ? chalk.bgBlack.white(` CTX: ${contextPercent}% left `) : '',
  ];

  if (pinned) {
    const rows = process.stdout.rows || 24;
    // Move to bottom, clear line, write bar, return to saved position or current
    process.stdout.write(`\x1b[s\x1b[${rows};1H\x1b[2K${barParts.filter(Boolean).join(' ')}\x1b[u`);
  } else {
    process.stdout.write('\n' + barParts.filter(Boolean).join(' ') + '\n\n');
  }
}

// Configure logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

// Handle graceful exit on Ctrl+C globally
process.on('SIGINT', () => {
  process.stdout.write('\x1b[r'); // Reset scrolling region
  console.log(chalk.green('\nGoodbye!'));
  process.exit(0);
});

// Set scrolling region to leave bottom line fixed
function setupScrollingRegion() {
  const rows = process.stdout.rows || 24;
  process.stdout.write(`\x1b[1;${rows - 1}r`);
}

// Define tools manually to avoid AI SDK v6 beta type issues
const tools: any = {
  getSystemInfo: {
    description: 'Get information about the current operating system and hardware.',
    parameters: z.object({}),
    execute: async () => {
      const info = {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
        freeMemory: `${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`,
      };
      logger.debug({ info }, 'Tool: getSystemInfo executed');
      return info;
    },
  },
  listDirectory: {
    description: 'List files and directories in a given path.',
    parameters: z.object({
      path: z
        .string()
        .optional()
        .describe('The directory path to list (defaults to current directory)'),
    }),
    execute: async ({ path: dirPath }: { path?: string }) => {
      const resolvedPath = path.resolve(process.cwd(), dirPath || '.');
      try {
        const files = fs.readdirSync(resolvedPath);
        return { path: resolvedPath, files };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  },
  executeShellCommand: {
    description: 'Execute a shell command on the local machine (safe commands only).',
    parameters: z.object({
      command: z.string().describe('The shell command to execute'),
    }),
    execute: async ({ command }: { command: string }) => {
      const forbidden = ['rm -rf /', 'mkfs', 'dd if='];
      if (forbidden.some((f) => command.includes(f))) {
        return { error: 'Command rejected for safety reasons.' };
      }

      try {
        const stdout = execSync(command, { encoding: 'utf8', timeout: 5000 });
        return { stdout: stdout.trim() };
      } catch (err: any) {
        return { error: err.message, stderr: err.stderr };
      }
    },
  },
};

const DEFAULT_MODELS = {
  grok: 'xai.grok-4',
  llama: 'meta.llama-3.3-70b-instruct',
  gemini: 'google.gemini-2.5-flash',
  cohere: 'cohere.command-r-plus',
  think: 'cohere.command-a-reasoning-08-2025',
};

const program = new Command();

program
  .name('oci-tui')
  .description('CLI tool to chat with OCI Generative AI models')
  .version('0.1.0');

// Global options
program
  .option('-m, --model <id>', 'Model ID to use', process.env.OCI_MODEL_ID || DEFAULT_MODELS.llama)
  .option('--grok', 'Use Grok 4')
  .option('--llama', 'Use Llama 3.3')
  .option('--gemini', 'Use Gemini 2.5 Flash')
  .option('--cohere', 'Use Command R+')
  .option('--think', 'Use Command A Reasoning')
  .option('-r, --region <id>', 'OCI Region', process.env.OCI_REGION || 'eu-frankfurt-1')
  .option('-c, --compartment <ocid>', 'OCI Compartment OCID', process.env.OCI_COMPARTMENT_ID)
  .option('--reasoning <level>', 'Reasoning effort (minimal, low, medium, high)')
  .option('--agent', 'Enable agentic behavior (allows model to use local tools)', false)
  .option('--no-stream', 'Disable streaming output');

program
  .command('ask')
  .description('Send a single query to the model')
  .argument('[prompt...]', 'The prompt to send')
  .action(async (promptParts, options) => {
    const opts = resolveOptions({ ...program.opts(), ...options });
    const prompt = promptParts.join(' ') || (await readStdin());

    if (!prompt) {
      logger.error('No prompt provided. Either pass it as an argument or pipe it to stdin.');
      process.exit(1);
    }

    await handleQuery(prompt, opts);
  });

program
  .command('chat')
  .description('Start an interactive chat session (REPL)')
  .action(async () => {
    await startRepl(resolveOptions(program.opts()));
  });

program
  .command('tui')
  .description('Start the TUI chat interface (experimental)')
  .action(async () => {
    const opts = resolveOptions(program.opts());
    const model = getModel(opts);
    await startTui(model, opts.region, opts.compartment, opts.reasoning);
  });

program
  .command('models')
  .description('List commonly used models')
  .action(() => {
    console.log(chalk.bold('\nCommon OCI Models:'));
    Object.entries(DEFAULT_MODELS).forEach(([key, id]) => {
      console.log(`  ${chalk.green(key.padEnd(10))} -> ${chalk.dim(id)}`);
    });
    console.log('');
  });

// Default action
program.action(async () => {
  const stdin = await readStdin();
  const opts = resolveOptions(program.opts());
  if (stdin) {
    await handleQuery(stdin, opts);
  } else if (process.argv.length <= 2) {
    program.help();
  } else {
    const prompt = process.argv
      .slice(2)
      .filter((a) => !a.startsWith('-'))
      .join(' ');
    if (prompt) {
      await handleQuery(prompt, opts);
    } else {
      await startRepl(opts);
    }
  }
});

function resolveOptions(opts: any) {
  const resolved = { ...opts };
  if (opts.grok) resolved.model = DEFAULT_MODELS.grok;
  if (opts.llama) resolved.model = DEFAULT_MODELS.llama;
  if (opts.gemini) resolved.model = DEFAULT_MODELS.gemini;
  if (opts.cohere) resolved.model = DEFAULT_MODELS.cohere;
  if (opts.think) {
    resolved.model = DEFAULT_MODELS.think;
    resolved.reasoning = resolved.reasoning || 'medium';
  }
  return resolved;
}

async function handleQuery(input: string, opts: any) {
  opts._lastPrompt = input;
  const model = getModel(opts);
  const callOpts: any = {
    model,
    prompt: input,
    tools: opts.agent ? tools : undefined,
    maxSteps: opts.agent ? 5 : 1,
    providerOptions: opts.reasoning
      ? { oci: { reasoningEffort: opts.reasoning, thinking: true } }
      : undefined,
  };

  try {
    if (opts.stream !== false) {
      let hasReasoning = false;
      let hasStartedText = false;
      let fullText = '';

      const result = streamText({
        ...callOpts,
        onChunk({ chunk }: any) {
          if (chunk.type === 'reasoning-delta') {
            if (!hasReasoning) {
              process.stdout.write(chalk.dim.italic('\nThinking: '));
              hasReasoning = true;
            }
            process.stdout.write(chalk.dim.italic(chunk.text));
          } else if (chunk.type === 'text-delta') {
            if (!hasStartedText) {
              if (hasReasoning) console.log('\n');
              process.stdout.write(chalk.blue('AI: '));
              hasStartedText = true;
            }
            process.stdout.write(chunk.text);
            fullText += chunk.text;
          }
        },
      });

      await result.text;
      console.log('\n');
      const usage = await result.usage;
      renderStatusBar(opts, usage, fullText, false);
      logger.debug({ usage }, 'Call completed');
    } else {
      const result = await generateText(callOpts);

      // Display tool calls if any
      result.steps.forEach((step) => {
        if (step.toolCalls.length > 0) {
          step.toolCalls.forEach((tc) => {
            console.log(chalk.cyan(`\n[Tool Call: ${tc.toolName}]`));
            console.log(
              chalk.dim(`Input: ${JSON.stringify((tc as any).args || (tc as any).input)}`)
            );
          });
        }
      });

      const reasoning = (result as any).reasoning || (result.steps[0] as any).reasoning;
      if (reasoning) {
        console.log(chalk.dim.italic(`\nThinking: ${reasoning}\n`));
      }

      process.stdout.write(chalk.blue('AI: '));
      console.log(result.text);
      renderStatusBar(opts, result.usage, result.text, false);
      logger.debug({ usage: result.usage }, 'Call completed');
    }
  } catch (error) {
    logger.error({ err: error }, 'Query failed');
    process.exit(1);
  }
}

async function startRepl(opts: any) {
  setupScrollingRegion();
  renderTopBar();
  const model = getModel(opts);

  if (opts.agent) console.log(chalk.cyan('Agentic mode enabled (Local tools available)'));
  console.log(chalk.dim('Type "exit", "quit", or press Ctrl+C to end the session\n'));

  // Initial status bar
  renderStatusBar(opts, undefined, undefined, true);

  while (true) {
    try {
      const { input } = await inquirer.prompt([
        {
          type: 'input',
          name: 'input',
          message: chalk.yellow('You:'),
          prefix: '',
        },
      ]);

      const cmd = input.toLowerCase().trim();
      if (['exit', 'quit', '/exit', '/quit'].includes(cmd)) {
        process.stdout.write('\x1b[r'); // Reset scrolling region
        console.log(chalk.green('Goodbye!'));
        process.exit(0);
      }

      if (!input.trim()) continue;

      opts._lastPrompt = input;

      try {
        let hasReasoning = false;
        let hasStartedText = false;
        let fullText = '';

        const result = streamText({
          model,
          prompt: input,
          tools: opts.agent ? tools : undefined,
          maxSteps: opts.agent ? 5 : 1,
          providerOptions: opts.reasoning
            ? { oci: { reasoningEffort: opts.reasoning, thinking: true } }
            : undefined,
          onChunk({ chunk }: any) {
            if (chunk.type === 'reasoning-delta') {
              if (!hasReasoning) {
                process.stdout.write(chalk.dim.italic('\nThinking: '));
                hasReasoning = true;
              }
              process.stdout.write(chalk.dim.italic(chunk.text));
            } else if (chunk.type === 'text-delta') {
              if (!hasStartedText) {
                if (hasReasoning) console.log('\n');
                process.stdout.write(chalk.blue('AI: '));
                hasStartedText = true;
              }
              process.stdout.write(chunk.text);
              fullText += chunk.text;
            }
          },
        } as any);

        await result.text;
        console.log('\n');
        const usage = await result.usage;
        renderStatusBar(opts, usage, fullText, true);
      } catch (error) {
        logger.error({ err: error }, 'Streaming failed');
        console.log('');
      }
    } catch (e: any) {
      // Handle inquirer force close (SIGINT)
      if (e.name === 'ExitPromptError') {
        process.stdout.write('\x1b[r'); // Reset scrolling region
        console.log(chalk.green('\nGoodbye!'));
        process.exit(0);
      }
      throw e;
    }
  }
}

function getModel(opts: any): LanguageModel {
  if (!opts.compartment) {
    logger.error('OCI_COMPARTMENT_ID or --compartment option is required');
    process.exit(1);
  }

  const provider = createOCI({
    compartmentId: opts.compartment,
    region: opts.region,
  });

  return provider.languageModel(opts.model) as unknown as LanguageModel;
}

async function readStdin(): Promise<string | null> {
  if (process.stdin.isTTY) return null;
  const chunks: string[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return chunks.join('').trim();
}

program.parse(process.argv);
