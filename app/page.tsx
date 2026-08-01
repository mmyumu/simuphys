"use client";

import {
  Gauge,
  Globe2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Timer,
  Wind,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExperimentCanvas } from "@/components/ExperimentCanvas";
import {
  AIR,
  BALL,
  DEFAULT_PARAMETERS,
  impactTimes,
  reynoldsNumber,
  sampleSimulation,
  sphereDragCoefficient,
  type SimulationParameters,
} from "@/lib/physics";

type RunState = "idle" | "running" | "paused" | "finished";
type NumericParameter = Exclude<
  keyof SimulationParameters,
  "airResistance"
>;

function formatValue(value: number, digits = 1) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [parameters, setParameters] =
    useState<SimulationParameters>(DEFAULT_PARAMETERS);
  const [time, setTime] = useState(0);
  const [runState, setRunState] = useState<RunState>("idle");
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const impacts = useMemo(() => impactTimes(parameters), [parameters]);
  const duration = Math.max(impacts.dropped, impacts.launched);
  const sample = useMemo(
    () => sampleSimulation(parameters, time),
    [parameters, time],
  );
  const currentSpeed = Math.hypot(sample.launched.vx, sample.launched.vy);
  const currentReynolds = reynoldsNumber(currentSpeed);
  const currentCd = sphereDragCoefficient(currentReynolds);
  const impactGap = Math.abs(impacts.launched - impacts.dropped);
  const isHorizontalLaunch = parameters.launchAngle === 0;
  const isUpwardLaunch = parameters.launchAngle > 0;
  const launchedArrivesLater = impacts.launched > impacts.dropped;
  const elapsedTimes = {
    dropped: Math.min(time, impacts.dropped),
    launched: Math.min(time, impacts.launched),
  };

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (runState !== "running") return;

    const tick = (now: number) => {
      if (lastFrameRef.current === null) lastFrameRef.current = now;
      const delta = Math.min((now - lastFrameRef.current) / 1000, 0.05);
      lastFrameRef.current = now;

      setTime((current) => {
        const next = current + delta * speed;
        if (next >= duration) {
          setRunState("finished");
          return duration;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = null;
    };
  }, [duration, runState, speed]);

  const reset = useCallback(() => {
    setRunState("idle");
    setTime(0);
  }, []);

  const togglePlayback = () => {
    if (runState === "finished") {
      setTime(0);
      setRunState("running");
      return;
    }
    setRunState((current) =>
      current === "running" ? "paused" : "running",
    );
  };

  const updateParameter = (
    key: NumericParameter,
    value: number,
  ) => {
    setParameters((current) => ({ ...current, [key]: value }));
    reset();
  };

  const seekTo = (nextTime: number) => {
    const clampedTime = Math.min(Math.max(nextTime, 0), duration);
    setTime(clampedTime);
    setRunState(
      clampedTime === 0
        ? "idle"
        : clampedTime >= duration
          ? "finished"
          : "paused",
    );
  };

  const progress = duration === 0 ? 0 : time / duration;
  const isRunning = runState === "running";

  return (
    <main className="app-shell" data-hydrated={hydrated ? "true" : "false"}>
      <header className="topbar">
        <a className="brand" href="#" aria-label="FallSim, accueil">
          <span className="brand-mark" aria-hidden="true">
            F
          </span>
          <span>
            <strong>FallSim</strong>
            <small>LABORATOIRE DE MÉCANIQUE</small>
          </span>
        </a>
        <div className="experiment-pill">
          <span className="live-dot" />
          Expérience 01
          <span>•</span>
          Chute libre
        </div>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">
            <Sparkles size={15} strokeWidth={2.2} />
            Même chute, chemins différents
          </p>
          <h1>Deux balles. Une seule gravité.</h1>
          <p className="intro-copy">
            L’une tombe droit, l’autre part selon l’angle que tu choisis.
            Lance l’expérience et observe ce que la gravité leur réserve.
          </p>
        </div>
        <div className="formula-card" aria-label="Équation du mouvement">
          <span>
            {parameters.airResistance
              ? "TRAÎNÉE AÉRODYNAMIQUE"
              : "POSITION VERTICALE"}
          </span>
          <strong>
            {parameters.airResistance ? (
              <>
                F<sub>d</sub> = <span>½ρC<sub>d</sub>(Re)Av²</span>
              </>
            ) : (
              <>
                y(t) = h + v₀sinθt − <span>½gt²</span>
              </>
            )}
          </strong>
        </div>
      </section>

      <section className="workspace">
        <div className="simulation-card">
          <div className="scene-heading">
            <div>
              <span className="section-number">01</span>
              <div>
                <p>ZONE D’OBSERVATION</p>
                <strong>Le grand saut</strong>
              </div>
            </div>
            <div className={`status status-${runState}`}>
              <span />
              {runState === "running"
                ? "En mouvement"
                : runState === "paused"
                  ? "En pause"
                  : runState === "finished"
                    ? "Impact"
                    : "Prêt"}
            </div>
          </div>

          <ExperimentCanvas
            parameters={parameters}
            time={time}
            runState={runState}
          />

          <div className="timeline">
            <div className="timeline-labels">
              <span>t = {formatValue(time, 2)} s</span>
              <span>dernier impact : {formatValue(duration, 2)} s</span>
            </div>
            <input
              className="timeline-track"
              type="range"
              min={0}
              max={duration}
              step={0.01}
              value={time}
              aria-label="Position dans l’expérience"
              aria-valuetext={`${formatValue(time, 2)} secondes`}
              style={
                { "--range-progress": `${progress * 100}%` } as React.CSSProperties
              }
              onChange={(event) => seekTo(Number(event.target.value))}
            />
          </div>

          <div className="transport">
            <button
              className="icon-button"
              onClick={reset}
              aria-label="Réinitialiser l’expérience"
              title="Réinitialiser"
            >
              <RotateCcw size={19} />
            </button>
            <button className="play-button" onClick={togglePlayback}>
              {isRunning ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              {isRunning
                ? "Mettre en pause"
                : runState === "paused"
                  ? "Reprendre"
                  : runState === "finished"
                    ? "Rejouer"
                    : "Lancer l’expérience"}
            </button>
            <div className="speed-control" aria-label="Vitesse de lecture">
              {[0.5, 1, 2].map((item) => (
                <button
                  key={item}
                  className={speed === item ? "active" : ""}
                  onClick={() => setSpeed(item)}
                >
                  ×{item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="control-panel">
          <div className="panel-title">
            <div>
              <span className="section-number inverse">02</span>
              <div>
                <p>PROTOCOLE</p>
                <strong>Paramètres</strong>
              </div>
            </div>
            <Gauge size={20} />
          </div>

          <div className="control-list">
            <label className="air-toggle">
              <span>
                <Wind size={17} aria-hidden="true" />
                <span>
                  <strong>Résistance de l’air</strong>
                  <small>
                    Sphère lisse • C<sub>d</sub> variable
                  </small>
                </span>
              </span>
              <input
                type="checkbox"
                checked={parameters.airResistance}
                aria-label="Résistance de l’air"
                onChange={(event) => {
                  setParameters((current) => ({
                    ...current,
                    airResistance: event.target.checked,
                  }));
                  reset();
                }}
              />
            </label>
            <RangeControl
              label="Hauteur de départ"
              value={parameters.height}
              min={10}
              max={100}
              step={1}
              unit="m"
              onChange={(value) => updateParameter("height", value)}
            />
            <RangeControl
              label="Vitesse de lancement"
              value={parameters.horizontalSpeed}
              min={2}
              max={30}
              step={1}
              unit="m/s"
              color="blue"
              onChange={(value) =>
                updateParameter("horizontalSpeed", value)
              }
            />
            <RangeControl
              label="Angle de lancement"
              value={parameters.launchAngle}
              min={-90}
              max={90}
              step={1}
              unit="°"
              color="blue"
              onChange={(value) => updateParameter("launchAngle", value)}
            />
            <RangeControl
              label="Gravité"
              value={parameters.gravity}
              min={1.6}
              max={15}
              step={0.01}
              unit="m/s²"
              color="violet"
              onChange={(value) => updateParameter("gravity", value)}
            />
          </div>

          <div className="ball-preset">
            <p>BALLE FIXE</p>
            <strong>{BALL.name}</strong>
            <span>Ø 40 mm • 2,7 g • surface lisse</span>
            {parameters.airResistance && (
              <span>
                C<sub>d</sub> actuel : {formatValue(currentCd, 3)}
                {" • "}Re :{" "}
                {Math.round(currentReynolds).toLocaleString("fr-FR")}
              </span>
            )}
          </div>

          <button
            className="earth-preset"
            onClick={() => {
              setParameters(DEFAULT_PARAMETERS);
              reset();
            }}
          >
            <Globe2 size={20} aria-hidden="true" />
            <span>
              <strong>Préréglage Terre</strong>
              <small>g = 9,81 m/s²</small>
            </span>
            <span>Appliquer</span>
          </button>

          <div className="key-card">
            <p>LÉGENDE</p>
            <div>
              <span><i className="ball ball-orange" /> Balle lâchée</span>
              <span><i className="ball ball-blue" /> Balle lancée</span>
              <span><i className="path-key" /> Trajectoire</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="readouts">
        <article className="metric-card">
          <div className="metric-heading">
            <span className="readout-icon orange"><Timer size={20} /></span>
            <p>TEMPS ÉCOULÉ</p>
          </div>
          <MetricPair
            dropped={formatValue(elapsedTimes.dropped, 2)}
            launched={formatValue(elapsedTimes.launched, 2)}
            unit="s"
          />
          <span className="metric-note">
            {parameters.airResistance
              ? `Écart entre les impacts : ${formatValue(impactGap, 2)} s`
              : isHorizontalLaunch
                ? "Impact simultané dans le vide"
                : `Le tir incliné reste en vol ${formatValue(impactGap, 2)} s de plus`}
          </span>
        </article>
        <article className="metric-card">
          <div className="metric-heading">
            <span className="readout-icon blue">↗</span>
            <p>DISTANCE HORIZONTALE</p>
          </div>
          <MetricPair
            dropped={formatValue(sample.dropped.x)}
            launched={formatValue(sample.launched.x)}
            unit="m"
          />
          <span className="metric-note">Position à l’instant t</span>
        </article>
        <article className="metric-card">
          <div className="metric-heading">
            <span className="readout-icon violet">↓</span>
            <p>VITESSE VERTICALE</p>
          </div>
          <MetricPair
            dropped={formatValue(sample.dropped.vy)}
            launched={formatValue(sample.launched.vy)}
            unit="m/s"
          />
          <span className="metric-note">
            {parameters.airResistance
              ? "La traînée dépend de la vitesse totale"
              : "Valeurs identiques dans le vide"}
          </span>
        </article>
      </section>

      <FormulaBreakdown
        parameters={parameters}
        time={time}
        sample={sample}
        impactTime={impacts.launched}
        speed={currentSpeed}
        reynolds={currentReynolds}
        dragCoefficient={currentCd}
      />

      <section className="insight">
        <span className="insight-mark">!</span>
        <div>
          <p>À RETENIR</p>
          <h2>
            {parameters.airResistance
              ? "L’air sépare les deux mouvements."
              : isHorizontalLaunch
                ? "Le mouvement horizontal ne ralentit pas la chute."
                : isUpwardLaunch
                  ? "L’angle prolonge le temps de vol."
                  : "Le tir vers le bas raccourcit le vol."}
          </h2>
          <span>
            {parameters.airResistance
              ? `La balle lancée rencontre plus de traînée car sa vitesse totale est plus grande. Elle arrive ${formatValue(impactGap, 2)} s ${launchedArrivesLater ? "après" : "avant"} la balle lâchée.`
              : isHorizontalLaunch
                ? "Dans le vide, la gravité agit de la même façon sur les deux balles. Elles touchent donc le sol exactement au même instant."
                : isUpwardLaunch
                  ? `La composante verticale initiale fait d’abord monter la balle lancée à ${formatValue(parameters.launchAngle, 0)}°, avant que la gravité ne la ramène au sol.`
                  : `À ${formatValue(parameters.launchAngle, 0)}°, la composante verticale initiale dirige immédiatement la balle vers le sol.`}
          </span>
        </div>
        <div className="mini-diagram" aria-hidden="true">
          <span className="mini-person">●</span>
          <span className="mini-arrow">→</span>
          <span className="mini-arc" />
          <i className="ball ball-blue" />
          <span className="mini-drop">↓</span>
          <i className="ball ball-orange" />
        </div>
      </section>

      <footer>
        <span>FallSim • Une expérience de mécanique classique</span>
        <span>
          MODÈLE : {parameters.airResistance ? "AIR • Cᴅ(Re)" : "VIDE PARFAIT"}
        </span>
      </footer>
    </main>
  );
}

type FormulaBreakdownProps = {
  parameters: SimulationParameters;
  time: number;
  sample: ReturnType<typeof sampleSimulation>;
  impactTime: number;
  speed: number;
  reynolds: number;
  dragCoefficient: number;
};

function FormulaBreakdown({
  parameters,
  time,
  sample,
  impactTime,
  speed,
  reynolds,
  dragCoefficient,
}: FormulaBreakdownProps) {
  const area = Math.PI * (BALL.diameter / 2) ** 2;
  const dragForce =
    0.5 * AIR.density * dragCoefficient * area * speed ** 2;
  const dragAcceleration = BALL.mass > 0 ? dragForce / BALL.mass : 0;
  const horizontalDrag =
    speed > 0 ? dragAcceleration * (sample.launched.vx / speed) : 0;
  const verticalDrag =
    speed > 0 ? dragAcceleration * (sample.launched.vy / speed) : 0;
  const halfGravity = parameters.gravity / 2;
  const angleRadians = (parameters.launchAngle * Math.PI) / 180;
  const initialHorizontalSpeed =
    parameters.horizontalSpeed * Math.cos(angleRadians);
  const initialUpwardSpeed =
    parameters.horizontalSpeed * Math.sin(angleRadians);

  return (
    <section
      className="formula-breakdown"
      aria-labelledby="formula-breakdown-title"
    >
      <div className="formula-heading">
        <div>
          <p>03 • MODÈLE MATHÉMATIQUE</p>
          <h2 id="formula-breakdown-title">Les calculs de la simulation</h2>
        </div>
        <span className="model-badge">
          {parameters.airResistance ? "AVEC RÉSISTANCE DE L’AIR" : "SANS AIR"}
        </span>
      </div>

      <div className="parameter-strip" aria-label="Valeurs des paramètres">
        <span><i>h</i> = {formatValue(parameters.height, 0)} m</span>
        <span><i>v₀</i> = {formatValue(parameters.horizontalSpeed, 0)} m/s</span>
        <span><i>θ</i> = {formatValue(parameters.launchAngle, 0)}°</span>
        <span><i>g</i> = {formatValue(parameters.gravity, 2)} m/s²</span>
        {parameters.airResistance && (
          <>
            <span><i>m</i> = {formatValue(BALL.mass * 1000, 1)} g</span>
            <span><i>D</i> = {formatValue(BALL.diameter * 1000, 0)} mm</span>
            <span><i>ρ</i> = {formatValue(AIR.density, 3)} kg/m³</span>
          </>
        )}
      </div>

      {parameters.airResistance ? (
        <div className="formula-columns">
          <article className="equation-card">
            <p>FORMULES THÉORIQUES</p>
            <div className="equation-list">
              <code>v = √(v<sub>x</sub>² + v<sub>y</sub>²)</code>
              <code>Re = ρvD / μ</code>
              <code>
                C<sub>d</sub>(Re) = 24/Re · (1 + 0,15Re<sup>0,681</sup>)
                + 0,407 / (1 + 8710/Re)
              </code>
              <code>F<sub>d</sub> = ½ρC<sub>d</sub>Av²</code>
              <code>
                dx/dt = v<sub>x</sub> ; dy/dt = −v<sub>y</sub>
              </code>
              <code>
                dv<sub>x</sub>/dt = −(F<sub>d</sub>/m) · v<sub>x</sub>/v
              </code>
              <code>
                dv<sub>y</sub>/dt = g − (F<sub>d</sub>/m) · v<sub>y</sub>/v
              </code>
            </div>
            <span>
              A = π(D/2)². Ce système sans solution fermée simple est intégré
              par RK4 avec un pas de 1/240 s.
            </span>
          </article>

          <article className="equation-card equation-card-values">
            <p>VALEURS INSTANTANÉES • BALLE LANCÉE • {formatValue(time, 2)} s</p>
            <div className="equation-list">
              <code>
                A = π × ({formatValue(BALL.diameter, 3)}/2)²
                = {formatValue(area, 6)} m²
              </code>
              <code>
                v = √({formatValue(sample.launched.vx, 2)}² +
                {formatValue(sample.launched.vy, 2)}²)
                = {formatValue(speed, 2)} m/s
              </code>
              <code>
                Re = ({formatValue(AIR.density, 3)} × {formatValue(speed, 2)}
                × {formatValue(BALL.diameter, 3)}) / 0,0000181
                = {Math.round(reynolds).toLocaleString("fr-FR")}
              </code>
              <code>
                C<sub>d</sub> = {formatValue(dragCoefficient, 3)}
                {" ; "}F<sub>d</sub> = {formatValue(dragForce, 4)} N
              </code>
              <code>
                dv<sub>x</sub>/dt = −{formatValue(horizontalDrag, 2)} m/s²
              </code>
              <code>
                dv<sub>y</sub>/dt = {formatValue(parameters.gravity, 2)}
                {" − "}{formatValue(verticalDrag, 2)}
                {" = "}{formatValue(parameters.gravity - verticalDrag, 2)} m/s²
              </code>
            </div>
            <span>
              Les valeurs instantanées évoluent avec le temps, car C<sub>d</sub>
              dépend lui-même de la vitesse via Reynolds.
            </span>
          </article>
        </div>
      ) : (
        <div className="formula-columns">
          <article className="equation-card">
            <p>FORMULES THÉORIQUES</p>
            <div className="equation-list">
              <code>x(t) = v₀ cos(θ)t</code>
              <code>y(t) = h + v₀ sin(θ)t − ½gt²</code>
              <code>v<sub>y</sub>(t) = gt − v₀ sin(θ)</code>
              <code>Balle lâchée : x(t) = 0 ; v<sub>x</sub> = 0</code>
              <code>
                t<sub>impact</sub> = (v₀ sin(θ) + √((v₀ sin(θ))² + 2gh)) / g
              </code>
            </div>
            <span>
              L’axe vertical est positif vers le haut, tandis que v<sub>y</sub>
              est affichée comme une vitesse vers le bas.
            </span>
          </article>

          <article className="equation-card equation-card-values">
            <p>AVEC LES VALEURS DES PARAMÈTRES</p>
            <div className="equation-list">
              <code>
                y(t) = {formatValue(parameters.height, 0)}
                {initialUpwardSpeed >= 0 ? " + " : " − "}
                {formatValue(Math.abs(initialUpwardSpeed), 2)}t
                {" − "}{formatValue(halfGravity, 3)}t²
              </code>
              <code>
                v<sub>y</sub>(t) = {formatValue(parameters.gravity, 2)}t
                {initialUpwardSpeed >= 0 ? " − " : " + "}
                {formatValue(Math.abs(initialUpwardSpeed), 2)}
              </code>
              <code>
                x<sub>lancée</sub>(t) =
                {" "}{formatValue(initialHorizontalSpeed, 2)}t
              </code>
              <code>
                t<sub>impact lancée</sub> = {formatValue(impactTime, 2)} s
              </code>
              <code>
                À l’instant {formatValue(time, 2)} s :
                {" "}y = {formatValue(sample.launched.y, 2)} m,
                {" "}x<sub>lancée</sub> = {formatValue(sample.launched.x, 2)} m
              </code>
            </div>
            <span>
              {parameters.launchAngle === 0
                ? "À 0°, les deux balles ont la même position et la même vitesse verticales à chaque instant."
                : parameters.launchAngle > 0
                  ? "La composante v₀ sin(θ) donne à la balle lancée une vitesse initiale vers le haut."
                  : "La composante v₀ sin(θ), négative, donne à la balle une vitesse initiale vers le sol."}
            </span>
          </article>
        </div>
      )}
    </section>
  );
}

type MetricPairProps = {
  dropped: string;
  launched: string;
  unit: string;
};

function MetricPair({ dropped, launched, unit }: MetricPairProps) {
  return (
    <div className="metric-pair">
      <div className="ball-metric metric-dropped">
        <span><i className="ball ball-orange" /> LÂCHÉE</span>
        <strong>{dropped} <small>{unit}</small></strong>
      </div>
      <div className="ball-metric metric-launched">
        <span><i className="ball ball-blue" /> LANCÉE</span>
        <strong>{launched} <small>{unit}</small></strong>
      </div>
    </div>
  );
}

type RangeControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  color?: "orange" | "blue" | "violet";
  onChange: (value: number) => void;
};

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  color = "orange",
  onChange,
}: RangeControlProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  return (
    <label className={`range-control range-${color}`}>
      <span className="range-header">
        <span>{label}</span>
        <strong>
          {formatValue(value, step < 1 ? 2 : 0)} <small>{unit}</small>
        </strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        style={{ "--range-progress": `${percentage}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="range-bounds">
        <span>{min}</span>
        <span>{max}</span>
      </span>
    </label>
  );
}
