import React, { useState, useCallback } from 'react';
import { useColors, useSpacing, useSizing } from '../../theme/index.js';

export interface InputAreaProps {
  /** Callback when message is submitted */
  onSubmit: (message: string) => void;
  /** Whether input is disabled (e.g., during streaming) */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input has focus */
  focused?: boolean;
}

export function InputArea({
  onSubmit,
  disabled = false,
  placeholder = 'Type your message...',
  focused = true,
}: InputAreaProps) {
  const colors = useColors();
  const spacing = useSpacing();
  const sizing = useSizing();
  const [value, setValue] = useState('');

  const handleInput = useCallback((newValue: string) => {
    setValue(newValue);
  }, []);

  const handleSubmit = useCallback(() => {
    if (disabled || !value.trim()) return;
    onSubmit(value.trim());
    setValue('');
  }, [disabled, value, onSubmit]);

  return (
    <box
      flexDirection="column"
      height={sizing.inputAreaHeight}
      padding={spacing.sm}
      backgroundColor={colors.bg.secondary}
      borderColor={focused ? colors.border.focused : colors.border.default}
      border
      borderStyle="single"
    >
      <box flexDirection="row" gap={1}>
        <box flexGrow={1}>
          <input
            value={value}
            onInput={handleInput}
            onSubmit={handleSubmit}
            placeholder={disabled ? 'Waiting...' : placeholder}
            focused={focused && !disabled}
            style={{
              fg: disabled ? colors.fg.disabled : colors.fg.primary,
              backgroundColor: colors.bg.tertiary,
            }}
          />
        </box>
        <text style={{ fg: colors.fg.tertiary }}>
          {disabled ? '...' : '[Enter] Send'}
        </text>
      </box>
    </box>
  );
}
