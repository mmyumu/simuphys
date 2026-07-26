"use client";

import {
  Gauge,
  Globe2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Timer,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExperimentCanvas } from "@/components/ExperimentCanvas";
import {
  DEFAULT_PARAMETERS,
  impactTime,
  sampleSimulation,
  type SimulationParameters,
} from "@/lib/physics";

type RunState = "idle" | "running" | "paused" | "finished";

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
  const duration = useMemo(() => impactTime(parameters), [parameters]);
  const sample = useMemo(
    () => sampleSimulation(parameters, time),
    [parameters, time],
  );

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
    key: keyof SimulationParameters,
    value: number,
  ) => {
    setParameters((current) => ({ ...current, [key]: value }));
    reset();
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
            L’une tombe droit, l’autre file à l’horizontale. Lance l’expérience
            et observe ce que la gravité leur réserve.
          </p>
        </div>
        <div className="formula-card" aria-label="Équation de la chute">
          <span>POSITION VERTICALE</span>
          <strong>
            y(t) = h − <span>½gt²</span>
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
              <span>impact prévu : {formatValue(duration, 2)} s</span>
            </div>
            <div className="timeline-track">
              <div
                className="timeline-fill"
                style={{ width: `${progress * 100}%` }}
              />
              <div
                className="timeline-thumb"
                style={{ left: `${progress * 100}%` }}
              />
            </div>
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
              label="Vitesse horizontale"
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
        <article>
          <span className="readout-icon orange"><Timer size={20} /></span>
          <div>
            <p>TEMPS DE CHUTE</p>
            <strong>{formatValue(duration, 2)} <small>s</small></strong>
          </div>
          <span className="readout-note">Identique pour les deux balles</span>
        </article>
        <article>
          <span className="readout-icon blue">↗</span>
          <div>
            <p>DISTANCE HORIZONTALE</p>
            <strong>{formatValue(sample.launched.x)} <small>m</small></strong>
          </div>
          <span className="readout-note">Balle lancée à l’instant t</span>
        </article>
        <article>
          <span className="readout-icon violet">↓</span>
          <div>
            <p>VITESSE VERTICALE</p>
            <strong>{formatValue(sample.dropped.vy)} <small>m/s</small></strong>
          </div>
          <span className="readout-note">Même valeur pour les deux</span>
        </article>
      </section>

      <section className="insight">
        <span className="insight-mark">!</span>
        <div>
          <p>À RETENIR</p>
          <h2>Le mouvement horizontal ne ralentit pas la chute.</h2>
          <span>
            Dans le vide, la gravité agit de la même façon sur les deux balles.
            Elles touchent donc le sol exactement au même instant.
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
        <span>MODÈLE : VIDE PARFAIT</span>
      </footer>
    </main>
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
