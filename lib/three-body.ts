export type Vector2 = {
  x: number;
  y: number;
};

export type ThreeBody = {
  id: string;
  name: string;
  mass: number;
  position: Vector2;
  velocity: Vector2;
};

export type GravitySystemState = {
  time: number;
  bodies: ThreeBody[];
};

export type ThreeBodyPresetId = "binary" | "figure-eight" | "close-encounter";

export type ThreeBodyPreset = {
  id: ThreeBodyPresetId;
  name: string;
  description: string;
  bodies: ThreeBody[];
  recommendedStep: number;
};

export const GRAVITATIONAL_CONSTANT = 6.6743e-11;
export const ASTRONOMICAL_UNIT = 149_597_870_700;
export const SOLAR_MASS = 1.98847e30;
export const DAY = 86_400;
export const DEFAULT_SOFTENING = 0.002 * ASTRONOMICAL_UNIT;

const MAXIMUM_STEP = 2 * DAY;
const BODY_NAMES = ["Aster", "Boreal", "Cygnus"] as const;

function makeBody(
  index: number,
  mass: number,
  position: Vector2,
  velocity: Vector2,
): ThreeBody {
  return {
    id: BODY_NAMES[index].toLocaleLowerCase("en"),
    name: BODY_NAMES[index],
    mass,
    position,
    velocity,
  };
}

function binaryPreset(): ThreeBodyPreset {
  const firstMass = SOLAR_MASS;
  const secondMass = 0.7 * SOLAR_MASS;
  const separation = ASTRONOMICAL_UNIT;
  const totalMass = firstMass + secondMass;
  const angularSpeed = Math.sqrt(
    (GRAVITATIONAL_CONSTANT * totalMass) / separation ** 3,
  );
  const firstRadius = separation * secondMass / totalMass;
  const secondRadius = separation * firstMass / totalMass;

  return {
    id: "binary",
    name: "Étoile binaire",
    description: "Deux masses configurées pour orbiter autour de leur centre commun.",
    bodies: [
      makeBody(0, firstMass, { x: -firstRadius, y: 0 }, { x: 0, y: -angularSpeed * firstRadius }),
      makeBody(1, secondMass, { x: secondRadius, y: 0 }, { x: 0, y: angularSpeed * secondRadius }),
    ],
    recommendedStep: 0.08 * DAY,
  };
}

function figureEightPreset(): ThreeBodyPreset {
  // Moore–Chenciner–Montgomery choreography, expressed in SI units.
  const mass = 0.7 * SOLAR_MASS;
  const lengthScale = 0.72 * ASTRONOMICAL_UNIT;
  const timeScale = Math.sqrt(lengthScale ** 3 / (GRAVITATIONAL_CONSTANT * mass));
  const velocityScale = lengthScale / timeScale;
  const period = 6.3259 * timeScale;

  return {
    id: "figure-eight",
    name: "Orbite en huit",
    description: "Conditions initiales précises d’une chorégraphie périodique connue.",
    bodies: [
      makeBody(0, mass, { x: -0.97000436 * lengthScale, y: 0.24308753 * lengthScale }, { x: 0.466203685 * velocityScale, y: 0.43236573 * velocityScale }),
      makeBody(1, mass, { x: 0.97000436 * lengthScale, y: -0.24308753 * lengthScale }, { x: 0.466203685 * velocityScale, y: 0.43236573 * velocityScale }),
      makeBody(2, mass, { x: 0, y: 0 }, { x: -0.93240737 * velocityScale, y: -0.86473146 * velocityScale }),
    ],
    recommendedStep: period / 5_400,
  };
}

function closeEncounterPreset(): ThreeBodyPreset {
  const mass = SOLAR_MASS;
  const distance = ASTRONOMICAL_UNIT;
  const speed = Math.sqrt((GRAVITATIONAL_CONSTANT * mass) / distance);

  return {
    id: "close-encounter",
    name: "Rencontre rapprochée",
    description: "Une troisième masse traverse une binaire sans résultat préparé.",
    bodies: [
      makeBody(0, mass, { x: -0.52 * distance, y: 0 }, { x: 0, y: -0.52 * speed }),
      makeBody(1, mass, { x: 0.52 * distance, y: 0 }, { x: 0, y: 0.52 * speed }),
      makeBody(2, 0.72 * mass, { x: 0.08 * distance, y: 1.45 * distance }, { x: 0.18 * speed, y: -0.84 * speed }),
    ],
    recommendedStep: 0.04 * DAY,
  };
}

export const THREE_BODY_PRESETS: Record<ThreeBodyPresetId, ThreeBodyPreset> = {
  binary: binaryPreset(),
  "figure-eight": figureEightPreset(),
  "close-encounter": closeEncounterPreset(),
};

export function createThirdBody(): ThreeBody {
  return makeBody(
    2,
    0.25 * SOLAR_MASS,
    { x: 0, y: 1.35 * ASTRONOMICAL_UNIT },
    { x: -22_000, y: 0 },
  );
}

export function createGravityState(bodies: readonly ThreeBody[]): GravitySystemState {
  const safeBodies = sanitizeBodies(bodies);
  return {
    time: 0,
    bodies: safeBodies.length >= 2 ? safeBodies : cloneBodies(THREE_BODY_PRESETS.binary.bodies),
  };
}

export function stepGravitySystem(
  state: GravitySystemState,
  requestedStep: number,
  requestedSoftening = DEFAULT_SOFTENING,
): GravitySystemState {
  if (!isValidState(state)) return createGravityState(state.bodies);
  if (!Number.isFinite(requestedStep) || requestedStep <= 0) return cloneState(state);
  const step = Math.min(requestedStep, MAXIMUM_STEP);
  const softening = Number.isFinite(requestedSoftening)
    ? Math.max(0, Math.min(requestedSoftening, ASTRONOMICAL_UNIT))
    : DEFAULT_SOFTENING;
  const firstAccelerations = accelerations(state.bodies, softening);
  const nextBodies = cloneBodies(state.bodies);

  nextBodies.forEach((body, index) => {
    body.position.x += body.velocity.x * step + 0.5 * firstAccelerations[index].x * step ** 2;
    body.position.y += body.velocity.y * step + 0.5 * firstAccelerations[index].y * step ** 2;
  });

  const secondAccelerations = accelerations(nextBodies, softening);
  nextBodies.forEach((body, index) => {
    body.velocity.x += 0.5 * (firstAccelerations[index].x + secondAccelerations[index].x) * step;
    body.velocity.y += 0.5 * (firstAccelerations[index].y + secondAccelerations[index].y) * step;
  });

  const nextState = { time: state.time + step, bodies: nextBodies };
  return isValidState(nextState) ? nextState : cloneState(state);
}

export function totalEnergy(
  bodies: readonly ThreeBody[],
  requestedSoftening = DEFAULT_SOFTENING,
) {
  if (!hasValidBodies(bodies)) return 0;
  const softening = Number.isFinite(requestedSoftening)
    ? Math.max(0, requestedSoftening)
    : DEFAULT_SOFTENING;
  let energy = bodies.reduce(
    (sum, body) => sum + 0.5 * body.mass * magnitudeSquared(body.velocity),
    0,
  );
  for (let first = 0; first < bodies.length; first += 1) {
    for (let second = first + 1; second < bodies.length; second += 1) {
      const delta = subtract(bodies[second].position, bodies[first].position);
      const distance = Math.sqrt(magnitudeSquared(delta) + softening ** 2);
      energy -= (GRAVITATIONAL_CONSTANT * bodies[first].mass * bodies[second].mass) / distance;
    }
  }
  return Number.isFinite(energy) ? energy : 0;
}

export function centerOfMass(bodies: readonly ThreeBody[]): Vector2 {
  if (!hasValidBodies(bodies)) return { x: 0, y: 0 };
  const totalMass = bodies.reduce((sum, body) => sum + body.mass, 0);
  return bodies.reduce(
    (center, body) => ({
      x: center.x + body.position.x * body.mass / totalMass,
      y: center.y + body.position.y * body.mass / totalMass,
    }),
    { x: 0, y: 0 },
  );
}

export function minimumDistance(bodies: readonly ThreeBody[]) {
  if (!hasValidBodies(bodies)) return 0;
  let minimum = Number.POSITIVE_INFINITY;
  for (let first = 0; first < bodies.length; first += 1) {
    for (let second = first + 1; second < bodies.length; second += 1) {
      minimum = Math.min(
        minimum,
        Math.hypot(
          bodies[second].position.x - bodies[first].position.x,
          bodies[second].position.y - bodies[first].position.y,
        ),
      );
    }
  }
  return Number.isFinite(minimum) ? minimum : 0;
}

function accelerations(bodies: readonly ThreeBody[], softening: number): Vector2[] {
  const result = bodies.map(() => ({ x: 0, y: 0 }));
  for (let first = 0; first < bodies.length; first += 1) {
    for (let second = first + 1; second < bodies.length; second += 1) {
      const delta = subtract(bodies[second].position, bodies[first].position);
      const distanceSquared = magnitudeSquared(delta) + softening ** 2;
      const inverseDistanceCubed = 1 / (distanceSquared * Math.sqrt(distanceSquared));
      const factor = GRAVITATIONAL_CONSTANT * inverseDistanceCubed;
      result[first].x += factor * bodies[second].mass * delta.x;
      result[first].y += factor * bodies[second].mass * delta.y;
      result[second].x -= factor * bodies[first].mass * delta.x;
      result[second].y -= factor * bodies[first].mass * delta.y;
    }
  }
  return result;
}

function sanitizeBodies(bodies: readonly ThreeBody[]) {
  return bodies.slice(0, 3).filter(isValidBody).map((body, index) => ({
    ...body,
    id: body.id || BODY_NAMES[index].toLocaleLowerCase("en"),
    name: body.name || BODY_NAMES[index],
    position: { ...body.position },
    velocity: { ...body.velocity },
  }));
}

function isValidBody(body: ThreeBody) {
  return Number.isFinite(body.mass) && body.mass > 0 &&
    Number.isFinite(body.position.x) && Number.isFinite(body.position.y) &&
    Number.isFinite(body.velocity.x) && Number.isFinite(body.velocity.y);
}

function hasValidBodies(bodies: readonly ThreeBody[]) {
  return bodies.length >= 2 && bodies.length <= 3 && bodies.every(isValidBody);
}

function isValidState(state: GravitySystemState) {
  return Number.isFinite(state.time) && state.time >= 0 && hasValidBodies(state.bodies);
}

function cloneBodies(bodies: readonly ThreeBody[]) {
  return bodies.map((body) => ({
    ...body,
    position: { ...body.position },
    velocity: { ...body.velocity },
  }));
}

function cloneState(state: GravitySystemState): GravitySystemState {
  return { time: state.time, bodies: cloneBodies(state.bodies) };
}

function subtract(first: Vector2, second: Vector2): Vector2 {
  return { x: first.x - second.x, y: first.y - second.y };
}

function magnitudeSquared(vector: Vector2) {
  return vector.x * vector.x + vector.y * vector.y;
}
