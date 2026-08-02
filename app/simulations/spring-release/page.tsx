"use client";

import {
  Activity,
  ArrowLeft,
  Gauge,
  Pause,
  RotateCcw,
  Scissors,
  Sparkles,
  Timer,
  Waves,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SpringDropCanvas } from "@/components/SpringDropCanvas";
import {
  DEFAULT_SPRING_DROP_PARAMETERS,
  sampleSpringDrop,
  springDropImpactTimes,
  springWaveTravelTime,
  suspendedSpringLength,
  type SpringDropParameters,
} from "@/lib/spring-drop";

type RunState = "idle" | "running" | "paused" | "finished";
type NumericParameter = keyof SpringDropParameters;

function formatValue(value: number, digits = 2) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function SpringReleasePage() {
  const [hydrated, setHydrated] = useState(false);
  const [parameters, setParameters] = useState<SpringDropParameters>(
    DEFAULT_SPRING_DROP_PARAMETERS,
  );
  const [time, setTime] = useState(0);
  const [runState, setRunState] = useState<RunState>("idle");
  const [speed, setSpeed] = useState(1);
  const animationFrame = useRef<number | null>(null);
  const lastFrame = useRef<number | null>(null);
  const impacts = useMemo(
    () => springDropImpactTimes(parameters),
    [parameters],
  );
  const duration = Math.max(impacts.rope, impacts.spring);
  const sample = useMemo(
    () => sampleSpringDrop(parameters, time),
    [parameters, time],
  );
  const waveTime = springWaveTravelTime(parameters);
  const springLength = suspendedSpringLength(parameters);
  const signedImpactGap = impacts.spring - impacts.rope;
  const impactGap = Math.abs(signedImpactGap);
  const winner =
    impactGap < 0.005
      ? "simultaneous"
      : signedImpactGap > 0
        ? "rope"
        : "spring";

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (runState !== "running") return;

    const tick = (now: number) => {
      if (lastFrame.current === null) lastFrame.current = now;
      const delta = Math.min((now - lastFrame.current) / 1000, 0.05);
      lastFrame.current = now;
      setTime((current) => {
        const next = current + delta * speed;
        if (next >= duration) {
          setRunState("finished");
          return duration;
        }
        return next;
      });
      animationFrame.current = requestAnimationFrame(tick);
    };

    animationFrame.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrame.current !== null) {
        cancelAnimationFrame(animationFrame.current);
      }
      lastFrame.current = null;
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

  const updateParameter = (key: NumericParameter, value: number) => {
    setParameters((current) => ({ ...current, [key]: value }));
    reset();
  };

  const seekTo = (nextTime: number) => {
    const clamped = Math.min(Math.max(nextTime, 0), duration);
    setTime(clamped);
    setRunState(
      clamped === 0 ? "idle" : clamped >= duration ? "finished" : "paused",
    );
  };

  const progress = duration === 0 ? 0 : time / duration;
  const isRunning = runState === "running";
  const waveHasArrived = sample.waveProgress >= 1;

  return (
    <main
      className="app-shell spring-release-shell"
      data-hydrated={hydrated ? "true" : "false"}
    >
      <header className="topbar">
        <a className="brand" href="/" aria-label="SimuPhys home">
          <span className="brand-mark spring-brand-mark" aria-hidden="true">S</span>
          <span>
            <strong>SpringDrop</strong>
            <small>LABORATOIRE DE MÉCANIQUE</small>
          </span>
        </a>
        <div className="experiment-nav">
          <a className="back-to-catalog" href="/">
            <ArrowLeft size={15} aria-hidden="true" />
            <span>Back to catalog</span>
          </a>
          <div className="experiment-pill">
            <span className="live-dot" />
            Expérience 02 <span>•</span> Onde de détente
          </div>
        </div>
      </header>

      <section className="intro spring-intro">
        <div>
          <p className="eyebrow">
            <Sparkles size={15} strokeWidth={2.2} />
            Une coupe, deux réponses
          </p>
          <h1>Qui touche le sol en premier&nbsp;?</h1>
          <p className="intro-copy">
            Coupe simultanément la corde et le ressort près du plafond. La
            corde libère aussitôt sa balle ; dans le ressort massif, une onde
            de détente doit encore descendre jusqu’à la seconde balle.
          </p>
        </div>
        <div className="formula-card spring-formula-card" aria-label="Temps de propagation de l’onde">
          <span>ORDRE DE GRANDEUR DE L’ONDE</span>
          <strong>
            τ ≈ <span>√(m<sub>r</sub> / k)</span>
          </strong>
          <small>{formatValue(waveTime, 3)} s avec ces paramètres</small>
        </div>
      </section>

      <section className="workspace">
        <div className="simulation-card">
          <div className="scene-heading">
            <div>
              <span className="section-number">01</span>
              <div>
                <p>ZONE D’OBSERVATION</p>
                <strong>La course vers le sol</strong>
              </div>
            </div>
            <div className={`status status-${runState}`}>
              <span />
              {runState === "running"
                ? waveHasArrived
                  ? "Deux balles en chute"
                  : "Onde en propagation"
                : runState === "paused"
                  ? "En pause"
                  : runState === "finished"
                    ? "Deux impacts"
                    : "Prêt à couper"}
            </div>
          </div>

          <SpringDropCanvas
            parameters={parameters}
            time={time}
            runState={runState}
          />

          <div className="timeline">
            <div className="timeline-labels">
              <span>t = {formatValue(time)} s</span>
              <span>dernier impact : {formatValue(duration)} s</span>
            </div>
            <input
              className="timeline-track"
              type="range"
              min={0}
              max={duration}
              step={0.01}
              value={time}
              aria-label="Position dans l’expérience"
              aria-valuetext={`${formatValue(time)} secondes`}
              style={{ "--range-progress": `${progress * 100}%` } as React.CSSProperties}
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
            <button className="play-button spring-play-button" onClick={togglePlayback}>
              {isRunning ? (
                <Pause size={20} fill="currentColor" />
              ) : (
                <Scissors size={20} />
              )}
              {isRunning
                ? "Mettre en pause"
                : runState === "paused"
                  ? "Reprendre"
                  : runState === "finished"
                    ? "Rejouer la coupe"
                    : "Couper les deux attaches"}
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

        <aside className="control-panel spring-control-panel">
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

          <div className="control-list spring-control-list">
            <RangeControl
              label="Hauteur des balles"
              value={parameters.height}
              min={1.5}
              max={6}
              step={0.1}
              unit="m"
              onChange={(value) => updateParameter("height", value)}
            />
            <RangeControl
              label="Masse de la balle"
              value={parameters.ballMass}
              min={0.1}
              max={1}
              step={0.05}
              unit="kg"
              color="blue"
              onChange={(value) => updateParameter("ballMass", value)}
            />
            <RangeControl
              label="Masse du ressort"
              value={parameters.springMass}
              min={0.1}
              max={1.2}
              step={0.05}
              unit="kg"
              color="violet"
              onChange={(value) => updateParameter("springMass", value)}
            />
            <RangeControl
              label="Raideur du ressort"
              value={parameters.stiffness}
              min={3}
              max={18}
              step={0.5}
              unit="N/m"
              color="blue"
              onChange={(value) => updateParameter("stiffness", value)}
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

          <div className="ball-preset spring-model-card">
            <p>MODÈLE DU RESSORT</p>
            <strong>24 masses ponctuelles reliées</strong>
            <span>Longueur à vide : {formatValue(parameters.naturalLength)} m</span>
            <span>Longueur suspendue : {formatValue(springLength)} m</span>
          </div>

          <button
            className="earth-preset"
            onClick={() => {
              setParameters(DEFAULT_SPRING_DROP_PARAMETERS);
              reset();
            }}
          >
            <RotateCcw size={20} aria-hidden="true" />
            <span>
              <strong>Configuration témoin</strong>
              <small>Ressort massif • Terre</small>
            </span>
            <span>Appliquer</span>
          </button>

          <div className="key-card">
            <p>LÉGENDE</p>
            <div>
              <span><i className="ball ball-orange" /> Balle côté corde</span>
              <span><i className="ball ball-blue" /> Balle côté ressort</span>
              <span><i className="spring-wave-key" /> Zone déjà détendue</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="readouts spring-readouts">
        <article className="metric-card">
          <div className="metric-heading">
            <span className="readout-icon orange"><Timer size={20} /></span>
            <p>TEMPS D’IMPACT</p>
          </div>
          <ComparisonMetric
            rope={formatValue(impacts.rope)}
            spring={formatValue(impacts.spring)}
            unit="s"
          />
          <span className="metric-note">
            {winner === "simultaneous"
              ? "Les impacts sont simultanés à la précision de l’affichage."
              : `${winner === "rope" ? "La corde" : "Le ressort"} gagne avec ${formatValue(impactGap)} s d’avance.`}
          </span>
        </article>
        <article className="metric-card">
          <div className="metric-heading">
            <span className="readout-icon blue"><Activity size={19} /></span>
            <p>VITESSE ACTUELLE</p>
          </div>
          <ComparisonMetric
            rope={formatValue(sample.ropeBallSpeed)}
            spring={formatValue(sample.springBallSpeed)}
            unit="m/s"
          />
          <span className="metric-note">Vitesse verticale vers le sol.</span>
        </article>
        <article className="metric-card">
          <div className="metric-heading">
            <span className="readout-icon violet"><Waves size={19} /></span>
            <p>ONDE DE DÉTENTE</p>
          </div>
          <strong>{formatValue(sample.waveProgress * 100, 0)} <small>%</small></strong>
          <span className="wave-meter" aria-hidden="true">
            <i style={{ width: `${sample.waveProgress * 100}%` }} />
          </span>
          <span className="metric-note">
            Tension sous la balle : {formatValue(sample.bottomTension)} N
          </span>
        </article>
      </section>

      <section className="formula-breakdown">
        <div className="formula-heading">
          <div>
            <p>03 • MODÈLE MATHÉMATIQUE</p>
            <h2>Pourquoi la balle du ressort attend</h2>
          </div>
          <span className="model-badge spring-model-badge">RESSORT MASSIF • 1D</span>
        </div>
        <div className="formula-columns">
          <article className="equation-card">
            <p>AU MOMENT DE LA COUPE</p>
            <div className="equation-list">
              <code>Balle corde : a = g</code>
              <code>Balle ressort : ma = mg − T</code>
              <code>À t = 0 : T = mg, donc a ≈ 0</code>
              <code>τ<sub>onde</sub> ≈ √(m<sub>ressort</sub> / k)</code>
            </div>
            <span>
              La disparition de la tension n’est pas instantanée : l’information
              mécanique se propage de spire en spire depuis la coupe.
            </span>
          </article>
          <article className="equation-card equation-card-values">
            <p>AVEC LES VALEURS CHOISIES</p>
            <div className="equation-list">
              <code>m<sub>balle</sub>g = {formatValue(parameters.ballMass * parameters.gravity)} N</code>
              <code>τ<sub>onde</sub> ≈ {formatValue(waveTime, 3)} s</code>
              <code>t<sub>corde</sub> = √(2h/g) = {formatValue(impacts.rope)} s</code>
              <code>t<sub>ressort</sub> = {formatValue(impacts.spring)} s</code>
              <code>Δt = {formatValue(impactGap)} s</code>
            </div>
            <span>
              Le calcul numérique utilise 24 masses et une intégration de
              Verlet au pas de 1/960 s.
            </span>
          </article>
        </div>
      </section>

      <section className="insight spring-insight">
        <span className="insight-mark">
          {winner === "rope" ? "C" : winner === "spring" ? "R" : "="}
        </span>
        <div>
          <p>VERDICT</p>
          <h2>
            {winner === "rope"
              ? "La balle côté corde touche le sol en premier."
              : winner === "spring"
                ? "La balle côté ressort rattrape son retard et gagne."
                : "Les deux balles touchent le sol presque ensemble."}
          </h2>
          <span>
            {winner === "rope"
              ? "La balle sous la corde tombe dès la coupe. Celle sous le ressort reste d’abord presque immobile, le temps que l’onde de détente atteigne les dernières spires."
              : winner === "spring"
                ? "La balle sous le ressort attend d’abord l’onde, puis le rappel élastique l’accélère assez pour dépasser la balle en chute libre avant le sol."
                : "Le délai de propagation et le rattrapage élastique se compensent presque exactement pour cette configuration."}
            {" "}Un ressort sans masse idéal donnerait une libération instantanée.
          </span>
        </div>
        <div className="spring-mini-diagram" aria-hidden="true">
          <i className="ball ball-orange" />
          <span>↓</span>
          <i className="spring-mini-coil">////</i>
          <i className="ball ball-blue" />
        </div>
      </section>

      <footer>
        <span>SpringDrop • Propagation d’une onde dans un ressort massif</span>
        <span>MODÈLE : CHAÎNE MASSE–RESSORT • SANS AIR</span>
      </footer>
    </main>
  );
}

type ComparisonMetricProps = {
  rope: string;
  spring: string;
  unit: string;
};

function ComparisonMetric({ rope, spring, unit }: ComparisonMetricProps) {
  return (
    <div className="metric-pair">
      <div className="ball-metric metric-dropped">
        <span><i className="ball ball-orange" /> CORDE</span>
        <strong>{rope} <small>{unit}</small></strong>
      </div>
      <div className="ball-metric metric-launched">
        <span><i className="ball ball-blue" /> RESSORT</span>
        <strong>{spring} <small>{unit}</small></strong>
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
          {formatValue(value, step < 0.1 ? 2 : 1)} <small>{unit}</small>
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
      <span className="range-bounds"><span>{min}</span><span>{max}</span></span>
    </label>
  );
}
