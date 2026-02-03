import React, { useEffect, useState } from 'react';
import { useAnimation, useColors } from '../../theme/index.js';

export type SpinnerVariant = 'dots' | 'pulse' | 'ring' | 'cursor';

export interface SpinnerProps {
  /** Custom label to display next to spinner */
  label?: string;
  /** Spinner variant */
  variant?: SpinnerVariant;
  /** Color override */
  color?: string;
  /** Size (affects some variants) */
  size?: 'small' | 'normal';
}

// Additional frame sets for new variants
const RING_FRAMES = ['◐', '◓', '◑', '◒'];
const CURSOR_FRAMES = ['▌', '▐', '█', '▐'];

export function Spinner({ label, variant = 'dots', color, size = 'normal' }: SpinnerProps) {
  const animation = useAnimation();
  const colors = useColors();
  const [frameIndex, setFrameIndex] = useState(0);

  // Select frames and interval based on variant
  const getFramesAndInterval = (): { frames: readonly string[]; interval: number } => {
    switch (variant) {
      case 'pulse':
        return { frames: animation.pulseFrames, interval: animation.pulseInterval };
      case 'ring':
        return { frames: RING_FRAMES, interval: 150 };
      case 'cursor':
        return { frames: CURSOR_FRAMES, interval: animation.cursorInterval };
      case 'dots':
      default:
        return { frames: animation.spinnerFrames, interval: animation.spinnerInterval };
    }
  };

  const { frames, interval } = getFramesAndInterval();

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, interval);

    return () => clearInterval(timer);
  }, [frames.length, interval]);

  const spinnerColor = color ?? colors.agent.thinking;

  return (
    <box flexDirection="row" gap={1}>
      <text style={{ fg: spinnerColor }}>{frames[frameIndex]}</text>
      {label && <text style={{ fg: colors.fg.secondary }}>{label}</text>}
    </box>
  );
}
