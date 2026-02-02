import React, { useEffect, useState } from 'react';
import { useColors, useAnimation } from '../../theme/index.js';

export interface StreamingTextProps {
  /** The full text content (may be partially complete during streaming) */
  text: string;
  /** Whether content is still being streamed */
  isStreaming?: boolean;
  /** Text color override */
  color?: string;
}

export function StreamingText({ text, isStreaming = false, color }: StreamingTextProps) {
  const colors = useColors();
  const animation = useAnimation();
  const [cursorVisible, setCursorVisible] = useState(true);

  // Blinking cursor during streaming
  useEffect(() => {
    if (!isStreaming) {
      setCursorVisible(false);
      return;
    }

    const timer = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, animation.cursorInterval);

    return () => clearInterval(timer);
  }, [isStreaming, animation.cursorInterval]);

  const textColor = color ?? colors.fg.primary;
  const cursor = cursorVisible && isStreaming ? animation.cursorFrames[0] : '';

  return (
    <text style={{ fg: textColor }}>
      {text}
      {cursor && (
        <span style={{ fg: colors.agent.streaming }}>{cursor}</span>
      )}
    </text>
  );
}
