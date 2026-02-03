import React, { useState, useCallback, useEffect } from 'react';
import { useKeyboard as useOpenTUIKeyboard } from '@opentui/react';
import { useColors, useSpacing } from '../../theme/index.js';

export interface Model {
  id: string;
  name: string;
  family: string;
  contextWindow?: string;
  note?: string;
}

export interface ModelPickerProps {
  isOpen: boolean;
  currentModel: string;
  models: Model[];
  region: string;
  onSelect: (modelId: string) => void;
  onClose: () => void;
}

export function ModelPicker({
  isOpen,
  currentModel,
  models,
  region,
  onSelect,
  onClose,
}: ModelPickerProps) {
  const colors = useColors();
  const spacing = useSpacing();
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Find current model index on open
  useEffect(() => {
    if (isOpen) {
      const idx = models.findIndex((m) => m.id === currentModel);
      if (idx >= 0) setSelectedIndex(idx);
    }
  }, [isOpen, currentModel, models]);

  // Keyboard navigation
  const handleKey = useCallback(
    (key: { name?: string; ctrl?: boolean }) => {
      if (!isOpen) return;

      switch (key.name) {
        case 'up':
        case 'k':
          setSelectedIndex((i) => Math.max(0, i - 1));
          break;
        case 'down':
        case 'j':
          setSelectedIndex((i) => Math.min(models.length - 1, i + 1));
          break;
        case 'return':
          onSelect(models[selectedIndex].id);
          onClose();
          break;
        case 'escape':
        case 'q':
          onClose();
          break;
        case 'home':
          setSelectedIndex(0);
          break;
        case 'end':
          setSelectedIndex(models.length - 1);
          break;
        case 'pageup':
          setSelectedIndex((i) => Math.max(0, i - 10));
          break;
        case 'pagedown':
          setSelectedIndex((i) => Math.min(models.length - 1, i + 10));
          break;
      }
    },
    [isOpen, models, selectedIndex, onSelect, onClose]
  );

  useOpenTUIKeyboard(handleKey);

  if (!isOpen) return null;

  // Group models by family
  const groupedModels: Record<string, Model[]> = {};
  for (const model of models) {
    if (!groupedModels[model.family]) {
      groupedModels[model.family] = [];
    }
    groupedModels[model.family].push(model);
  }

  // Flatten for rendering with section headers
  let currentIdx = 0;
  const renderItems: Array<{ type: 'header' | 'model'; family?: string; model?: Model; idx?: number }> = [];

  for (const [family, familyModels] of Object.entries(groupedModels)) {
    renderItems.push({ type: 'header', family });
    for (const model of familyModels) {
      renderItems.push({ type: 'model', model, idx: currentIdx });
      currentIdx++;
    }
  }

  return (
    <box
      flexDirection="column"
      position="absolute"
      top={2}
      left={5}
      width={70}
      height={30}
      border
      borderStyle="double"
      borderColor={colors.accent.primary}
      backgroundColor={colors.bg.primary}
      padding={1}
    >
      {/* Header */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        style={{ marginBottom: spacing.sm }}
      >
        <text style={{ fg: colors.fg.primary }}>
          Select Model
        </text>
        <text style={{ fg: colors.fg.tertiary }}>
          Region: {region}
        </text>
      </box>

      {/* Model List */}
      <scrollbox
        style={{
          maxHeight: 22,
          backgroundColor: colors.bg.secondary,
        }}
      >
        {renderItems.map((item, i) => {
          if (item.type === 'header') {
            return (
              <box key={`header-${item.family}`} style={{ marginTop: i > 0 ? 1 : 0 }}>
                <text style={{ fg: colors.accent.secondary }}>
                  ─ {item.family} ─
                </text>
              </box>
            );
          }

          const model = item.model!;
          const isSelected = item.idx === selectedIndex;
          const isCurrent = model.id === currentModel;

          return (
            <box
              key={model.id}
              flexDirection="row"
              justifyContent="space-between"
              style={{
                paddingLeft: 1,
                paddingRight: 1,
                backgroundColor: isSelected ? colors.bg.elevated : undefined,
              }}
            >
              <box flexDirection="row" gap={1}>
                <text style={{ fg: isCurrent ? colors.accent.primary : colors.fg.tertiary }}>
                  {isCurrent ? '●' : isSelected ? '▸' : ' '}
                </text>
                <text style={{ fg: isSelected ? colors.fg.primary : colors.fg.secondary }}>
                  {model.name}
                </text>
                {model.note && (
                  <text style={{ fg: colors.fg.tertiary }}>
                    ({model.note})
                  </text>
                )}
              </box>
              {model.contextWindow && (
                <text style={{ fg: colors.fg.tertiary }}>
                  {model.contextWindow}
                </text>
              )}
            </box>
          );
        })}
      </scrollbox>

      {/* Footer hints */}
      <box
        flexDirection="row"
        justifyContent="center"
        gap={2}
        style={{ marginTop: spacing.xs }}
      >
        <text style={{ fg: colors.fg.tertiary }}>
          [↑↓] navigate  [Enter] select  [Esc] cancel
        </text>
      </box>
    </box>
  );
}

// Available models list
export const AVAILABLE_MODELS: Model[] = [
  // xAI Grok
  { id: 'xai.grok-4', name: 'Grok 4', family: 'xAI Grok' },
  { id: 'xai.grok-4-fast-reasoning', name: 'Grok 4 Fast Reasoning', family: 'xAI Grok' },
  { id: 'xai.grok-4-fast-non-reasoning', name: 'Grok 4 Fast', family: 'xAI Grok' },
  { id: 'xai.grok-4-1-fast-reasoning', name: 'Grok 4.1 Fast Reasoning', family: 'xAI Grok', contextWindow: '2M' },
  { id: 'xai.grok-4-1-fast-non-reasoning', name: 'Grok 4.1 Fast', family: 'xAI Grok' },
  { id: 'xai.grok-3', name: 'Grok 3', family: 'xAI Grok' },
  { id: 'xai.grok-3-fast', name: 'Grok 3 Fast', family: 'xAI Grok' },
  { id: 'xai.grok-3-mini', name: 'Grok 3 Mini', family: 'xAI Grok' },
  { id: 'xai.grok-3-mini-fast', name: 'Grok 3 Mini Fast', family: 'xAI Grok' },
  { id: 'xai.grok-code-fast-1', name: 'Grok Code Fast 1', family: 'xAI Grok' },

  // Google Gemini
  { id: 'google.gemini-2.5-pro', name: 'Gemini 2.5 Pro', family: 'Google Gemini', contextWindow: '1M' },
  { id: 'google.gemini-2.5-flash', name: 'Gemini 2.5 Flash', family: 'Google Gemini', contextWindow: '1M' },
  { id: 'google.gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', family: 'Google Gemini', note: 'No tools' },

  // Meta Llama 4
  { id: 'meta.llama-4-maverick-17b-128e-instruct-fp8', name: 'Llama 4 Maverick', family: 'Meta Llama' },
  { id: 'meta.llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout', family: 'Meta Llama' },

  // Meta Llama 3.x
  { id: 'meta.llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', family: 'Meta Llama', note: 'Default' },
  { id: 'meta.llama-3.2-90b-vision-instruct', name: 'Llama 3.2 Vision 90B', family: 'Meta Llama' },
  { id: 'meta.llama-3.2-11b-vision-instruct', name: 'Llama 3.2 Vision 11B', family: 'Meta Llama' },
  { id: 'meta.llama-3.1-405b-instruct', name: 'Llama 3.1 405B', family: 'Meta Llama', note: 'Dedicated' },
  { id: 'meta.llama-3.1-70b-instruct', name: 'Llama 3.1 70B', family: 'Meta Llama' },

  // Cohere Command
  { id: 'cohere.command-a-03-2025', name: 'Command A (Mar 2025)', family: 'Cohere' },
  { id: 'cohere.command-a-reasoning-08-2025', name: 'Command A Reasoning', family: 'Cohere' },
  { id: 'cohere.command-a-vision-07-2025', name: 'Command A Vision', family: 'Cohere' },
  { id: 'cohere.command-plus-latest', name: 'Command+ (Latest)', family: 'Cohere' },
  { id: 'cohere.command-latest', name: 'Command (Latest)', family: 'Cohere' },
  { id: 'cohere.command-r-plus-08-2024', name: 'Command R+ (Aug 2024)', family: 'Cohere' },
  { id: 'cohere.command-r-plus', name: 'Command R+ (Latest)', family: 'Cohere' },
  { id: 'cohere.command-r-08-2024', name: 'Command R (Aug 2024)', family: 'Cohere' },
  { id: 'cohere.command-r-16k', name: 'Command R 16K', family: 'Cohere' },

  // OpenAI GPT-OSS
  { id: 'openai.gpt-oss-120b', name: 'GPT-OSS 120B', family: 'OpenAI GPT-OSS' },
  { id: 'openai.gpt-oss-20b', name: 'GPT-OSS 20B', family: 'OpenAI GPT-OSS' },
];
