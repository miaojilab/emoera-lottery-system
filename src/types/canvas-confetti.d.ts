declare module 'canvas-confetti' {
  interface ConfettiConfig {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    ticks?: number;
    origin?: {
      x?: number;
      y?: number;
    };
    colors?: string[];
    shapes?: string[];
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }

  type ConfettiFire = (options?: ConfettiConfig) => Promise<null>;

  interface ConfettiFunction extends ConfettiFire {
    reset: () => void;
  }

  const confetti: ConfettiFunction;
  export default confetti;
} 