import { describe, expect, it } from "vitest";
import {
  ASTRONOMICAL_UNIT,
  DAY,
  THREE_BODY_PRESETS,
  centerOfMass,
  createGravityState,
  createThirdBody,
  minimumDistance,
  stepGravitySystem,
  totalEnergy,
  type GravitySystemState,
} from "../lib/three-body";

function advance(state: GravitySystemState, step: number, count: number) {
  let current = state;
  for (let index = 0; index < count; index += 1) {
    current = stepGravitySystem(current, step);
  }
  return current;
}

describe("simulateur gravitationnel pas-à-pas", () => {
  it("recalcule l’attraction mutuelle à chaque pas", () => {
    const state = createGravityState([
      {
        id: "a",
        name: "A",
        mass: 1e28,
        position: { x: -1e9, y: 0 },
        velocity: { x: 0, y: 0 },
      },
      {
        id: "b",
        name: "B",
        mass: 1e28,
        position: { x: 1e9, y: 0 },
        velocity: { x: 0, y: 0 },
      },
    ]);
    const first = stepGravitySystem(state, 10);
    const second = stepGravitySystem(first, 10);

    expect(first.bodies[0].velocity.x).toBeGreaterThan(0);
    expect(first.bodies[1].velocity.x).toBeLessThan(0);
    expect(second.bodies[0].velocity.x).toBeGreaterThan(first.bodies[0].velocity.x);
    expect(second.time).toBe(20);
  });

  it("maintient la binaire liée pendant une révolution", () => {
    const preset = THREE_BODY_PRESETS.binary;
    const initial = createGravityState(preset.bodies);
    const final = advance(initial, preset.recommendedStep, 4_600);
    const distance = minimumDistance(final.bodies);

    expect(distance / ASTRONOMICAL_UNIT).toBeGreaterThan(0.98);
    expect(distance / ASTRONOMICAL_UNIT).toBeLessThan(1.02);
  });

  it("conserve l’énergie avec l’intégrateur velocity-Verlet", () => {
    const preset = THREE_BODY_PRESETS["figure-eight"];
    const initial = createGravityState(preset.bodies);
    const initialEnergy = totalEnergy(initial.bodies);
    const final = advance(initial, preset.recommendedStep, 5_400);
    const drift = Math.abs((totalEnergy(final.bodies) - initialEnergy) / initialEnergy);

    expect(drift).toBeLessThan(2e-4);
  });

  it("ne contient aucune trajectoire future précalculée", () => {
    const preset = THREE_BODY_PRESETS["close-encounter"];
    const initial = createGravityState(preset.bodies);
    const next = stepGravitySystem(initial, preset.recommendedStep);

    expect(initial).toHaveProperty("time", 0);
    expect(initial).not.toHaveProperty("samples");
    expect(next.time).toBeCloseTo(preset.recommendedStep, 6);
    expect(next.bodies).not.toEqual(initial.bodies);
  });

  it("accepte au choix deux ou trois corps", () => {
    const binary = createGravityState(THREE_BODY_PRESETS.binary.bodies);
    const ternary = createGravityState([...binary.bodies, createThirdBody()]);

    expect(binary.bodies).toHaveLength(2);
    expect(ternary.bodies).toHaveLength(3);
    expect(centerOfMass(ternary.bodies)).toEqual(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    );
  });

  it("rejette un pas invalide et ne laisse pas passer de NaN", () => {
    const initial = createGravityState(THREE_BODY_PRESETS.binary.bodies);
    const unchanged = stepGravitySystem(initial, Number.NaN);
    const recovered = createGravityState([
      { ...initial.bodies[0], mass: Number.NaN },
      initial.bodies[1],
    ]);

    expect(unchanged).toEqual(initial);
    expect(recovered.bodies).toHaveLength(2);
    expect(recovered.bodies.every((body) => Number.isFinite(body.mass))).toBe(true);
    expect(stepGravitySystem(initial, DAY).bodies.every((body) =>
      Number.isFinite(body.position.x) && Number.isFinite(body.velocity.y),
    )).toBe(true);
  });
});
