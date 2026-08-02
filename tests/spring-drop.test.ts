import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPRING_DROP_PARAMETERS,
  sampleSpringDrop,
  springDropImpactTimes,
  springWaveTravelTime,
  suspendedSpringLength,
} from "../lib/spring-drop";

describe("moteur de détente d’un ressort massif", () => {
  it("place les deux balles à la même hauteur avant la coupe", () => {
    const sample = sampleSpringDrop(DEFAULT_SPRING_DROP_PARAMETERS, 0);

    expect(sample.ropeBallHeight).toBe(DEFAULT_SPRING_DROP_PARAMETERS.height);
    expect(sample.springBallHeight).toBe(DEFAULT_SPRING_DROP_PARAMETERS.height);
    expect(sample.bottomTension).toBeCloseTo(
      DEFAULT_SPRING_DROP_PARAMETERS.ballMass *
        DEFAULT_SPRING_DROP_PARAMETERS.gravity,
      6,
    );
  });

  it("calcule l’allongement statique du ressort massif", () => {
    expect(suspendedSpringLength(DEFAULT_SPRING_DROP_PARAMETERS)).toBeGreaterThan(
      DEFAULT_SPRING_DROP_PARAMETERS.naturalLength,
    );
  });

  it("maintient d’abord la balle du ressort presque immobile", () => {
    const observationTime =
      springWaveTravelTime(DEFAULT_SPRING_DROP_PARAMETERS) * 0.45;
    const sample = sampleSpringDrop(
      DEFAULT_SPRING_DROP_PARAMETERS,
      observationTime,
    );

    expect(sample.ropeBallHeight).toBeLessThan(
      DEFAULT_SPRING_DROP_PARAMETERS.height - 0.2,
    );
    expect(sample.springBallHeight).toBeGreaterThan(
      DEFAULT_SPRING_DROP_PARAMETERS.height - 0.02,
    );
  });

  it("fait gagner la balle côté corde avec la configuration témoin", () => {
    const impacts = springDropImpactTimes(DEFAULT_SPRING_DROP_PARAMETERS);

    expect(impacts.rope).toBeCloseTo(
      Math.sqrt(
        (2 * DEFAULT_SPRING_DROP_PARAMETERS.height) /
          DEFAULT_SPRING_DROP_PARAMETERS.gravity,
      ),
      6,
    );
    expect(impacts.spring - impacts.rope).toBeGreaterThan(0.05);
  });

  it("reproduit un rattrapage élastique quand les paramètres le permettent", () => {
    const impacts = springDropImpactTimes({
      ...DEFAULT_SPRING_DROP_PARAMETERS,
      ballMass: 1,
      springMass: 1.2,
      stiffness: 3,
      gravity: 1.6,
    });

    expect(impacts.spring).toBeLessThan(impacts.rope);
  });

  it("bloque les deux balles au sol après le dernier impact", () => {
    const sample = sampleSpringDrop(DEFAULT_SPRING_DROP_PARAMETERS, 100);

    expect(sample.ropeBallHeight).toBe(0);
    expect(sample.springBallHeight).toBe(0);
    expect(sample.ropeImpacted).toBe(true);
    expect(sample.springImpacted).toBe(true);
  });

  it("gère un environnement invalide sans produire de NaN", () => {
    const invalid = {
      ...DEFAULT_SPRING_DROP_PARAMETERS,
      stiffness: 0,
    };

    expect(springDropImpactTimes(invalid)).toEqual({ rope: 0, spring: 0 });
    expect(sampleSpringDrop(invalid, 1).time).toBe(0);
  });
});
