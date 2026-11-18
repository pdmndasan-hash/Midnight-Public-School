import React, { useEffect, useRef } from 'react';
import { drawPhotorealisticPortrait } from '../game/humanTextures';
import { HumanAppearance } from '../types/game';

interface PortraitCanvasProps {
  appearance: HumanAppearance;
  className?: string;
  alt: string;
}

export const PortraitCanvas: React.FC<PortraitCanvasProps> = ({ appearance, className, alt }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    drawPhotorealisticPortrait(canvasRef.current, appearance);
  }, [appearance]);

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={192}
      aria-label={alt}
      className={className}
    />
  );
};
