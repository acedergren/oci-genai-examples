import React from 'react';
import { useColors, useSpacing } from '../../theme/index.js';
import { Message, type MessageProps } from './Message.js';
import { InputArea } from './InputArea.js';

export interface ChatMessage extends MessageProps {
  id: string;
}

export interface ChatViewProps {
  /** Array of messages to display */
  messages: ChatMessage[];
  /** Callback when a message is submitted */
  onSendMessage: (message: string) => void;
  /** Whether the agent is currently responding */
  isResponding?: boolean;
  /** Whether input area has focus */
  inputFocused?: boolean;
}

export function ChatView({
  messages,
  onSendMessage,
  isResponding = false,
  inputFocused = true,
}: ChatViewProps) {
  const colors = useColors();
  const spacing = useSpacing();

  return (
    <box flexDirection="column" flexGrow={1}>
      {/* Messages area - scrollable */}
      <scrollbox
        flexGrow={1}
        stickyScroll
        stickyStart="bottom"
        padding={spacing.md}
        backgroundColor={colors.bg.primary}
        style={{
          scrollbarOptions: {
            trackOptions: {
              foregroundColor: colors.fg.tertiary,
              backgroundColor: colors.bg.secondary,
            },
          },
        }}
      >
        {messages.length === 0 ? (
          <box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
            <text style={{ fg: colors.fg.tertiary }}>
              {'◆ OCI GenAI Agent'}
            </text>
            <text style={{ fg: colors.fg.tertiary }}>
              Start a conversation...
            </text>
          </box>
        ) : (
          messages.map((msg) => (
            <Message
              key={msg.id}
              role={msg.role}
              content={msg.content}
              reasoning={msg.reasoning}
              isStreaming={msg.isStreaming}
              toolCalls={msg.toolCalls}
              timestamp={msg.timestamp}
            />
          ))
        )}
      </scrollbox>

      {/* Input area */}
      <InputArea
        onSubmit={onSendMessage}
        disabled={isResponding}
        focused={inputFocused}
      />
    </box>
  );
}
