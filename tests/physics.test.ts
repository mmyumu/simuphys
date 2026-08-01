import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARAMETERS,
  impactDistance,
  impactTime,
  impactTimes,
  sampleSimulation,
  sphereDragCoefficient,
} from "../lib/physics";

const VACUUM_PARAMETERS = {
  ...DEFAULT_PARAMETERS,
  airResistance: false,
};

describe("moteur de chute libre", () => {
  it("calcule le temps d'impact terrestre", () => {
    expect(impactTime(VACUUM_PARAMETERS)).toBeCloseTo(3.029, 3);
  });

  it("conserve la vitesse horizontale de la balle lancée", () => {
    const sample = sampleSimulation(VACUUM_PARAMETERS, 1.5);
    expect(sample.launched.vx).toBe(12);
    expect(sample.launched.x).toBe(18);
    expect(sample.dropped.x).toBe(0);
  });

  it("décompose la vitesse selon l'angle de lancement", () => {
    const angled = {
      ...VACUUM_PARAMETERS,
      launchAngle: 45,
    };
    const sample = sampleSimulation(angled, 0);

    expect(sample.launched.vx).toBeCloseTo(12 / Math.sqrt(2), 6);
    expect(sample.launched.vy).toBeCloseTo(-12 / Math.sqrt(2), 6);
  });

  it("prolonge le vol quand la balle est lancée vers le haut", () => {
    const angled = {
      ...VACUUM_PARAMETERS,
      launchAngle: 45,
    };
    const impacts = impactTimes(angled);
    const afterDroppedImpact = sampleSimulation(angled, 3.2);

    expect(impacts.launched).toBeGreaterThan(impacts.dropped);
    expect(afterDroppedImpact.droppedImpacted).toBe(true);
    expect(afterDroppedImpact.launchedImpacted).toBe(false);
    expect(afterDroppedImpact.launched.y).toBeGreaterThan(0);
  });

  it("donne la même position et vitesse verticales aux deux balles", () => {
    const sample = sampleSimulation(VACUUM_PARAMETERS, 2);
    expect(sample.dropped.y).toBe(sample.launched.y);
    expect(sample.dropped.vy).toBe(sample.launched.vy);
  });

  it("bloque les deux balles au sol au même instant", () => {
    const sample = sampleSimulation(VACUUM_PARAMETERS, 100);
    expect(sample.hasImpacted).toBe(true);
    expect(sample.dropped.y).toBe(0);
    expect(sample.launched.y).toBe(0);
    expect(sample.time).toBe(impactTime(VACUUM_PARAMETERS));
  });

  it("gère les paramètres physiques invalides sans NaN", () => {
    const invalid = {
      height: -10,
      horizontalSpeed: 4,
      launchAngle: 0,
      gravity: 0,
      airResistance: true,
    };
    expect(impactTime(invalid)).toBe(0);
    expect(sampleSimulation(invalid, 2).time).toBe(0);
  });

  it("fait varier le coefficient de traînée avec Reynolds", () => {
    expect(sphereDragCoefficient(100)).toBeCloseTo(1.04, 1);
    expect(sphereDragCoefficient(50_000)).toBeCloseTo(0.46, 2);
    expect(sphereDragCoefficient(100)).not.toBe(
      sphereDragCoefficient(50_000),
    );
  });

  it("retarde davantage la balle lancée dans l'air", () => {
    const impacts = impactTimes(DEFAULT_PARAMETERS);
    expect(impacts.dropped).toBeGreaterThan(5);
    expect(impacts.launched).toBeGreaterThan(impacts.dropped);
    expect(impacts.launched - impacts.dropped).toBeGreaterThan(0.1);
  });

  it("réduit la portée et la vitesse horizontale dans l'air", () => {
    const finalSample = sampleSimulation(
      DEFAULT_PARAMETERS,
      impactTime(DEFAULT_PARAMETERS),
    );
    expect(impactDistance(DEFAULT_PARAMETERS)).toBeLessThan(
      impactDistance(VACUUM_PARAMETERS),
    );
    expect(finalSample.launched.vx).toBeLessThan(
      DEFAULT_PARAMETERS.horizontalSpeed,
    );
  });
});
