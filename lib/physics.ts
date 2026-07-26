export type SimulationParameters = {
  height: number;
  horizontalSpeed: number;
  gravity: number;
  airResistance: boolean;
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
  droppedImpacted: boolean;
  launchedImpacted: boolean;
  hasImpacted: boolean;
};

export type ImpactTimes = {
  dropped: number;
  launched: number;
};

export const BALL = {
  name: "Balle légère en ABS",
  diameter: 0.04,
  mass: 0.0027,
} as const;

export const AIR = {
  density: 1.225,
  dynamicViscosity: 1.81e-5,
} as const;

export const DEFAULT_PARAMETERS: SimulationParameters = {
  height: 45,
  horizontalSpeed: 12,
  gravity: 9.81,
  airResistance: true,
};

const INTEGRATION_STEP = 1 / 240;
const SPHERE_AREA = Math.PI * (BALL.diameter / 2) ** 2;

type IntegratedBall = {
  state: BallState;
  time: number;
  impacted: boolean;
};

type Derivative = BallState;

/**
 * Brown–Lawler correlation for the standard drag curve of a smooth sphere.
 * Valid for Re < 2×10⁵, which comfortably covers this experiment.
 */
export function sphereDragCoefficient(reynolds: number) {
  if (!Number.isFinite(reynolds) || reynolds <= 0) return 0;
  return (
    (24 / reynolds) * (1 + 0.15 * reynolds ** 0.681) +
    0.407 / (1 + 8710 / reynolds)
  );
}

export function reynoldsNumber(speed: number) {
  if (!Number.isFinite(speed) || speed <= 0) return 0;
  return (
    (AIR.density * speed * BALL.diameter) / AIR.dynamicViscosity
  );
}

export function impactTimes(parameters: SimulationParameters): ImpactTimes {
  if (!hasValidEnvironment(parameters)) {
    return { dropped: 0, launched: 0 };
  }

  if (!parameters.airResistance) {
    const time = Math.sqrt((2 * parameters.height) / parameters.gravity);
    return { dropped: time, launched: time };
  }

  return {
    dropped: integrateBall(parameters, 0, Number.POSITIVE_INFINITY).time,
    launched: integrateBall(
      parameters,
      parameters.horizontalSpeed,
      Number.POSITIVE_INFINITY,
    ).time,
  };
}

/**
 * Duration of the complete experiment. With air enabled, this is the impact
 * time of the last ball rather than an assertion that both impacts coincide.
 */
export function impactTime(parameters: SimulationParameters) {
  const times = impactTimes(parameters);
  return Math.max(times.dropped, times.launched);
}

export function sampleSimulation(
  parameters: SimulationParameters,
  requestedTime: number,
): SimulationSample {
  if (!hasValidEnvironment(parameters)) {
    const state = initialState(Math.max(0, parameters.height), 0);
    return {
      time: 0,
      dropped: state,
      launched: initialState(
        Math.max(0, parameters.height),
        parameters.horizontalSpeed,
      ),
      droppedImpacted: true,
      launchedImpacted: true,
      hasImpacted: true,
    };
  }

  const time = Math.max(0, requestedTime);

  if (!parameters.airResistance) {
    const endTime = Math.sqrt(
      (2 * parameters.height) / parameters.gravity,
    );
    const clampedTime = Math.min(time, endTime);
    const verticalPosition = Math.max(
      0,
      parameters.height -
        0.5 * parameters.gravity * clampedTime * clampedTime,
    );
    const verticalSpeed = parameters.gravity * clampedTime;
    const impacted = clampedTime >= endTime;

    return {
      time: clampedTime,
      dropped: {
        x: 0,
        y: verticalPosition,
        vx: 0,
        vy: verticalSpeed,
      },
      launched: {
        x: parameters.horizontalSpeed * clampedTime,
        y: verticalPosition,
        vx: parameters.horizontalSpeed,
        vy: verticalSpeed,
      },
      droppedImpacted: impacted,
      launchedImpacted: impacted,
      hasImpacted: impacted,
    };
  }

  const dropped = integrateBall(parameters, 0, time);
  const launched = integrateBall(parameters, parameters.horizontalSpeed, time);

  return {
    time: Math.min(time, Math.max(dropped.time, launched.time)),
    dropped: dropped.state,
    launched: launched.state,
    droppedImpacted: dropped.impacted,
    launchedImpacted: launched.impacted,
    hasImpacted: dropped.impacted && launched.impacted,
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

export function impactDistance(parameters: SimulationParameters) {
  const endTime = impactTime(parameters);
  return sampleSimulation(parameters, endTime).launched.x;
}

function hasValidEnvironment(parameters: SimulationParameters) {
  return (
    Number.isFinite(parameters.height) &&
    Number.isFinite(parameters.gravity) &&
    parameters.height > 0 &&
    parameters.gravity > 0
  );
}

function initialState(height: number, horizontalSpeed: number): BallState {
  return {
    x: 0,
    y: height,
    vx: horizontalSpeed,
    vy: 0,
  };
}

function derivative(
  state: BallState,
  parameters: SimulationParameters,
): Derivative {
  const speed = Math.hypot(state.vx, state.vy);
  let dragFactor = 0;

  if (speed > 0) {
    const cd = sphereDragCoefficient(reynoldsNumber(speed));
    dragFactor =
      (0.5 * AIR.density * cd * SPHERE_AREA * speed) / BALL.mass;
  }

  return {
    x: state.vx,
    y: -state.vy,
    vx: -dragFactor * state.vx,
    vy: parameters.gravity - dragFactor * state.vy,
  };
}

function addDerivative(
  state: BallState,
  derivativeValue: Derivative,
  step: number,
): BallState {
  return {
    x: state.x + derivativeValue.x * step,
    y: state.y + derivativeValue.y * step,
    vx: state.vx + derivativeValue.vx * step,
    vy: state.vy + derivativeValue.vy * step,
  };
}

function rk4Step(
  state: BallState,
  step: number,
  parameters: SimulationParameters,
): BallState {
  const k1 = derivative(state, parameters);
  const k2 = derivative(addDerivative(state, k1, step / 2), parameters);
  const k3 = derivative(addDerivative(state, k2, step / 2), parameters);
  const k4 = derivative(addDerivative(state, k3, step), parameters);

  return {
    x: state.x + (step / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
    y: state.y + (step / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
    vx:
      state.vx + (step / 6) * (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx),
    vy:
      state.vy + (step / 6) * (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy),
  };
}

function integrateBall(
  parameters: SimulationParameters,
  horizontalSpeed: number,
  requestedTime: number,
): IntegratedBall {
  let state = initialState(parameters.height, horizontalSpeed);
  let time = 0;

  while (state.y > 0 && time < requestedTime) {
    const step = Math.min(INTEGRATION_STEP, requestedTime - time);
    const next = rk4Step(state, step, parameters);

    if (next.y <= 0) {
      const fraction = state.y / (state.y - next.y);
      const impactState: BallState = {
        x: state.x + (next.x - state.x) * fraction,
        y: 0,
        vx: state.vx + (next.vx - state.vx) * fraction,
        vy: state.vy + (next.vy - state.vy) * fraction,
      };
      return {
        state: impactState,
        time: time + step * fraction,
        impacted: true,
      };
    }

    state = next;
    time += step;
  }

  return {
    state,
    time,
    impacted: state.y <= 0,
  };
}
