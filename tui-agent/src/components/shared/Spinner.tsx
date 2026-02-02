import React, { useEffect, useState } from 'react';
import { useAnimation, useColors } from '../../theme/index.js';

export interface SpinnerProps {
  /** Custom label to display next to spinner */
  label?: string;
  /** Spinner variant */
  variant?: 'dots' | 'pulse';
  /** Color override */
  color?: string;
}

export function Spinner({ label, variant = 'dots', color }: SpinnerProps) {
  const animation = useAnimation();
  const colors = useColors();
  const [frameIndex, setFrameIndex] = useState(0);

  const frames = variant === 'pulse' ? animation.pulseFrames : animation.spinnerFrames;
  const interval = variant === 'pulse' ? animation.pulseInterval : animation.spinnerInterval;

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
