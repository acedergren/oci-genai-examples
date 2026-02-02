import React from 'react';
import { useColors, useSpacing, typography } from '../../theme/index.js';

export interface CodeBlockProps {
  /** Code content */
  code: string;
  /** Programming language for syntax highlighting hint */
  language?: string;
  /** Optional title/filename */
  title?: string;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Maximum height before scrolling */
  maxHeight?: number;
}

export function CodeBlock({
  code,
  language,
  title,
  showLineNumbers = true,
  maxHeight,
}: CodeBlockProps) {
  const colors = useColors();
  const spacing = useSpacing();

  const lines = code.split('\n');
  const lineNumberWidth = String(lines.length).length;

  return (
    <box
      flexDirection="column"
      border
      borderStyle="single"
      borderColor={colors.border.muted}
      style={{ width: typography.codeBlockWidth }}
    >
      {/* Header with language/title */}
      {(language || title) && (
        <box
          flexDirection="row"
          justifyContent="space-between"
          padding={1}
          backgroundColor={colors.bg.elevated}
          borderColor={colors.border.muted}
        >
          {title && <text style={{ fg: colors.fg.primary }}>{title}</text>}
          {language && (
            <text style={{ fg: colors.fg.tertiary }}>{language}</text>
          )}
        </box>
      )}

      {/* Code content */}
      <scrollbox
        style={{
          backgroundColor: colors.bg.tertiary,
          padding: spacing.sm,
          ...(maxHeight ? { height: maxHeight } : {}),
        }}
      >
        {lines.map((line, index) => (
          <box key={index} flexDirection="row">
            {showLineNumbers && (
              <text
                style={{
                  fg: colors.fg.tertiary,
                  width: lineNumberWidth + 2,
                }}
              >
                {String(index + 1).padStart(lineNumberWidth, ' ')} │
              </text>
            )}
            <text style={{ fg: colors.fg.primary }}>
              {line || ' '}
            </text>
          </box>
        ))}
      </scrollbox>
    </box>
  );
}
