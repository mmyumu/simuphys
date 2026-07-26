import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARAMETERS,
  impactTime,
  sampleSimulation,
} from "../lib/physics";

describe("moteur de chute libre", () => {
  it("calcule le temps d'impact terrestre", () => {
    expect(impactTime(DEFAULT_PARAMETERS)).toBeCloseTo(3.029, 3);
  });

  it("conserve la vitesse horizontale de la balle lancée", () => {
    const sample = sampleSimulation(DEFAULT_PARAMETERS, 1.5);
    expect(sample.launched.vx).toBe(12);
    expect(sample.launched.x).toBe(18);
    expect(sample.dropped.x).toBe(0);
  });

  it("donne la même position et vitesse verticales aux deux balles", () => {
    const sample = sampleSimulation(DEFAULT_PARAMETERS, 2);
    expect(sample.dropped.y).toBe(sample.launched.y);
    expect(sample.dropped.vy).toBe(sample.launched.vy);
  });

  it("bloque les deux balles au sol au même instant", () => {
    const sample = sampleSimulation(DEFAULT_PARAMETERS, 100);
    expect(sample.hasImpacted).toBe(true);
    expect(sample.dropped.y).toBe(0);
    expect(sample.launched.y).toBe(0);
    expect(sample.time).toBe(impactTime(DEFAULT_PARAMETERS));
  });

  it("gère les paramètres physiques invalides sans NaN", () => {
    const invalid = { height: -10, horizontalSpeed: 4, gravity: 0 };
    expect(impactTime(invalid)).toBe(0);
    expect(sampleSimulation(invalid, 2).time).toBe(0);
  });
});
