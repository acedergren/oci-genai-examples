import React, { useEffect, useState } from 'react';
import { useColors, useAnimation } from '../../theme/index.js';

export interface StreamingTextProps {
  /** The full text content (may be partially complete during streaming) */
  text: string;
  /** Whether content is still being streamed */
  isStreaming?: boolean;
  /** Text color override */
  color?: string;
  /** Show cursor style */
  cursorStyle?: 'blink' | 'pulse' | 'solid';
}

// Streaming cursor animation frames (more visible)
const STREAMING_CURSOR_FRAMES = ['█', '▓', '▒', '░', '▒', '▓'];

export function StreamingText({
  text,
  isStreaming = false,
  color,
  cursorStyle = 'pulse',
}: StreamingTextProps) {
  const colors = useColors();
  const animation = useAnimation();
  const [cursorFrame, setCursorFrame] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);

  // Cursor animation during streaming
  useEffect(() => {
    if (!isStreaming) {
      setCursorVisible(false);
      setCursorFrame(0);
      return;
    }

    setCursorVisible(true);

    if (cursorStyle === 'solid') {
      // Static cursor, no animation needed
      return;
    }

    if (cursorStyle === 'blink') {
      // Simple blink animation
      const timer = setInterval(() => {
        setCursorVisible((prev) => !prev);
      }, animation.cursorInterval);
      return () => clearInterval(timer);
    }

    // Pulse animation (default) - smooth gradient effect
    const timer = setInterval(() => {
      setCursorFrame((prev) => (prev + 1) % STREAMING_CURSOR_FRAMES.length);
    }, 100);

    return () => clearInterval(timer);
  }, [isStreaming, cursorStyle, animation.cursorInterval]);

  const textColor = color ?? colors.fg.primary;

  // Determine cursor character
  let cursor = '';
  if (isStreaming && cursorVisible) {
    if (cursorStyle === 'pulse') {
      cursor = STREAMING_CURSOR_FRAMES[cursorFrame];
    } else {
      cursor = animation.cursorFrames[0];
    }
  }

  return (
    <text style={{ fg: textColor }}>
      {text}
      {cursor && (
        <span style={{ fg: colors.agent.streaming }}>{cursor}</span>
      )}
    </text>
  );
}
