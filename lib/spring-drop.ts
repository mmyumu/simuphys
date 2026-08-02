export type SpringDropParameters = {
  height: number;
  ballMass: number;
  springMass: number;
  stiffness: number;
  naturalLength: number;
  gravity: number;
};

export type SpringDropImpactTimes = {
  rope: number;
  spring: number;
};

export type SpringDropSample = {
  time: number;
  ropeBallHeight: number;
  ropeBallSpeed: number;
  springBallHeight: number;
  springBallSpeed: number;
  springNodeHeights: number[];
  bottomTension: number;
  waveProgress: number;
  ropeImpacted: boolean;
  springImpacted: boolean;
};

export const DEFAULT_SPRING_DROP_PARAMETERS: SpringDropParameters = {
  height: 3.2,
  ballMass: 0.25,
  springMass: 0.8,
  stiffness: 3,
  naturalLength: 1.15,
  gravity: 9.81,
};

const SEGMENT_COUNT = 24;
const INTEGRATION_STEP = 1 / 960;
const MAX_SIMULATION_TIME = 12;

type ChainState = {
  positions: number[];
  velocities: number[];
  initialBallPosition: number;
};

export function suspendedSpringLength(parameters: SpringDropParameters) {
  if (!hasValidParameters(parameters)) return 0;
  return createEquilibriumState(parameters).initialBallPosition;
}

export function springWaveTravelTime(parameters: SpringDropParameters) {
  if (!hasValidParameters(parameters)) return 0;
  return Math.sqrt(parameters.springMass / parameters.stiffness);
}

export function springDropImpactTimes(
  parameters: SpringDropParameters,
): SpringDropImpactTimes {
  if (!hasValidParameters(parameters)) return { rope: 0, spring: 0 };

  const rope = Math.sqrt((2 * parameters.height) / parameters.gravity);
  const spring = integrateChain(
    parameters,
    Number.POSITIVE_INFINITY,
  ).time;

  return { rope, spring };
}

export function sampleSpringDrop(
  parameters: SpringDropParameters,
  requestedTime: number,
): SpringDropSample {
  if (!hasValidParameters(parameters)) {
    return {
      time: 0,
      ropeBallHeight: Math.max(0, parameters.height),
      ropeBallSpeed: 0,
      springBallHeight: Math.max(0, parameters.height),
      springBallSpeed: 0,
      springNodeHeights: [],
      bottomTension: 0,
      waveProgress: 0,
      ropeImpacted: true,
      springImpacted: true,
    };
  }

  const impacts = springDropImpactTimes(parameters);
  const time = Math.min(
    Math.max(0, requestedTime),
    Math.max(impacts.rope, impacts.spring),
  );
  const ropeTime = Math.min(time, impacts.rope);
  const ropeImpacted = time >= impacts.rope;
  const integrated = integrateChain(parameters, Math.min(time, impacts.spring));
  const state = integrated.state;
  const ballIndex = state.positions.length - 1;
  const springImpacted = time >= impacts.spring;
  const springBallHeight = springImpacted
    ? 0
    : Math.max(
        0,
        parameters.height -
          (state.positions[ballIndex] - state.initialBallPosition),
      );
  const segmentLength = parameters.naturalLength / SEGMENT_COUNT;
  const segmentStiffness = parameters.stiffness * SEGMENT_COUNT;
  const bottomExtension =
    state.positions[ballIndex] -
    state.positions[ballIndex - 1] -
    segmentLength;

  return {
    time,
    ropeBallHeight: ropeImpacted
      ? 0
      : Math.max(
          0,
          parameters.height -
            0.5 * parameters.gravity * ropeTime * ropeTime,
        ),
    ropeBallSpeed: ropeImpacted ? parameters.gravity * impacts.rope : parameters.gravity * ropeTime,
    springBallHeight,
    springBallSpeed: Math.max(0, state.velocities[ballIndex]),
    springNodeHeights: state.positions.slice(0, -1).map((position) =>
      parameters.height - (position - state.initialBallPosition),
    ),
    bottomTension: Math.max(0, segmentStiffness * bottomExtension),
    waveProgress: Math.min(
      1,
      time / Math.max(INTEGRATION_STEP, springWaveTravelTime(parameters)),
    ),
    ropeImpacted,
    springImpacted,
  };
}

function hasValidParameters(parameters: SpringDropParameters) {
  return (
    Number.isFinite(parameters.height) &&
    Number.isFinite(parameters.ballMass) &&
    Number.isFinite(parameters.springMass) &&
    Number.isFinite(parameters.stiffness) &&
    Number.isFinite(parameters.naturalLength) &&
    Number.isFinite(parameters.gravity) &&
    parameters.height > 0 &&
    parameters.ballMass > 0 &&
    parameters.springMass > 0 &&
    parameters.stiffness > 0 &&
    parameters.naturalLength > 0 &&
    parameters.gravity > 0
  );
}

function createEquilibriumState(
  parameters: SpringDropParameters,
): ChainState {
  const nodeMass = parameters.springMass / SEGMENT_COUNT;
  const segmentLength = parameters.naturalLength / SEGMENT_COUNT;
  const segmentStiffness = parameters.stiffness * SEGMENT_COUNT;
  const positions = Array.from({ length: SEGMENT_COUNT + 1 }, () => 0);

  for (let index = 1; index <= SEGMENT_COUNT; index += 1) {
    const springNodesBelow = SEGMENT_COUNT - index;
    const supportedMass = parameters.ballMass + springNodesBelow * nodeMass;
    const extension = (supportedMass * parameters.gravity) / segmentStiffness;
    positions[index] = positions[index - 1] + segmentLength + extension;
  }

  return {
    positions,
    velocities: positions.map(() => 0),
    initialBallPosition: positions[positions.length - 1],
  };
}

function accelerations(
  parameters: SpringDropParameters,
  positions: number[],
) {
  const ballIndex = positions.length - 1;
  const nodeMass = parameters.springMass / SEGMENT_COUNT;
  const segmentLength = parameters.naturalLength / SEGMENT_COUNT;
  const segmentStiffness = parameters.stiffness * SEGMENT_COUNT;
  const forces = positions.map((_, index) =>
    (index === ballIndex ? parameters.ballMass : nodeMass) *
    parameters.gravity,
  );

  for (let index = 0; index < ballIndex; index += 1) {
    const extension = positions[index + 1] - positions[index] - segmentLength;
    const tension = segmentStiffness * extension;
    forces[index] += tension;
    forces[index + 1] -= tension;
  }

  return forces.map((force, index) =>
    force / (index === ballIndex ? parameters.ballMass : nodeMass),
  );
}

function stepChain(
  parameters: SpringDropParameters,
  state: ChainState,
  step: number,
) {
  const firstAcceleration = accelerations(parameters, state.positions);
  const nextPositions = state.positions.map(
    (position, index) =>
      position +
      state.velocities[index] * step +
      0.5 * firstAcceleration[index] * step * step,
  );
  const secondAcceleration = accelerations(parameters, nextPositions);
  const nextVelocities = state.velocities.map(
    (velocity, index) =>
      velocity +
      0.5 * (firstAcceleration[index] + secondAcceleration[index]) * step,
  );

  return {
    positions: nextPositions,
    velocities: nextVelocities,
    initialBallPosition: state.initialBallPosition,
  };
}

function integrateChain(
  parameters: SpringDropParameters,
  requestedTime: number,
) {
  let state = createEquilibriumState(parameters);
  let time = 0;
  const targetTime = Math.min(requestedTime, MAX_SIMULATION_TIME);
  let ballHeight = parameters.height;

  while (time < targetTime && ballHeight > 0) {
    const step = Math.min(INTEGRATION_STEP, targetTime - time);
    const nextState = stepChain(parameters, state, step);
    const ballIndex = nextState.positions.length - 1;
    const nextHeight =
      parameters.height -
      (nextState.positions[ballIndex] - nextState.initialBallPosition);

    if (nextHeight <= 0) {
      const fraction = ballHeight / (ballHeight - nextHeight);
      state = {
        positions: state.positions.map(
          (position, index) =>
            position + (nextState.positions[index] - position) * fraction,
        ),
        velocities: state.velocities.map(
          (velocity, index) =>
            velocity + (nextState.velocities[index] - velocity) * fraction,
        ),
        initialBallPosition: state.initialBallPosition,
      };
      time += step * fraction;
      ballHeight = 0;
      break;
    }

    state = nextState;
    time += step;
    ballHeight = nextHeight;
  }

  return { state, time };
}
