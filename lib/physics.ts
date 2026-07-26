export type SimulationParameters = {
  height: number;
  horizontalSpeed: number;
  gravity: number;
};

export type BallState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type SimulationSample = {
  time: number;
  dropped: BallState;
  launched: BallState;
  hasImpacted: boolean;
};

export const DEFAULT_PARAMETERS: SimulationParameters = {
  height: 45,
  horizontalSpeed: 12,
  gravity: 9.81,
};

export function impactTime({ height, gravity }: SimulationParameters) {
  if (height <= 0 || gravity <= 0) return 0;
  return Math.sqrt((2 * height) / gravity);
}

export function sampleSimulation(
  parameters: SimulationParameters,
  requestedTime: number,
): SimulationSample {
  const endTime = impactTime(parameters);
  const time = Math.max(0, Math.min(requestedTime, endTime));
  const verticalPosition = Math.max(
    0,
    parameters.height - 0.5 * parameters.gravity * time * time,
  );
  const verticalSpeed = parameters.gravity * time;

  return {
    time,
    dropped: {
      x: 0,
      y: verticalPosition,
      vx: 0,
      vy: verticalSpeed,
    },
    launched: {
      x: parameters.horizontalSpeed * time,
      y: verticalPosition,
      vx: parameters.horizontalSpeed,
      vy: verticalSpeed,
    },
    hasImpacted: time >= endTime,
  };
}

export function trajectorySamples(
  parameters: SimulationParameters,
  elapsedTime: number,
  count = 36,
) {
  if (elapsedTime <= 0) return [sampleSimulation(parameters, 0)];
  return Array.from({ length: count + 1 }, (_, index) =>
    sampleSimulation(parameters, (elapsedTime * index) / count),
  );
}
