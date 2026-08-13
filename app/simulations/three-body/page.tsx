"use client";

import {
  Activity,
  ArrowLeft,
  Gauge,
  Orbit,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Timer,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThreeBodyCanvas } from "@/components/ThreeBodyCanvas";
import {
  ASTRONOMICAL_UNIT,
  DAY,
  SOLAR_MASS,
  THREE_BODY_PRESETS,
  centerOfMass,
  createGravityState,
  createThirdBody,
  minimumDistance,
  stepGravitySystem,
  totalEnergy,
  type GravitySystemState,
  type ThreeBody,
  type ThreeBodyPresetId,
  type Vector2,
} from "@/lib/three-body";

type RunState = "idle" | "running" | "paused";
type BodyField = "mass" | "x" | "y" | "vx" | "vy";

const PRESET_IDS: ThreeBodyPresetId[] = ["binary", "close-encounter", "figure-eight"];
const PLAYBACK_RATES = [10, 50, 200] as const;
const TRAIL_SAMPLE_INTERVAL = 0.2 * DAY;
const MAXIMUM_TRAIL_POINTS = 2_400;

function formatNumber(value: number, digits = 2) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDistance(distance: number) {
  if (distance >= 0.01 * ASTRONOMICAL_UNIT) {
    return `${formatNumber(distance / ASTRONOMICAL_UNIT, 3)} ua`;
  }
  return `${formatNumber(distance / 1_000, 0)} km`;
}

function initialTrails(bodies: readonly ThreeBody[]): Vector2[][] {
  return bodies.map((body) => [{ ...body.position }]);
}

export default function ThreeBodyPage() {
  const defaultPreset = THREE_BODY_PRESETS.binary;
  const defaultState = useMemo(() => createGravityState(defaultPreset.bodies), [defaultPreset.bodies]);
  const [hydrated, setHydrated] = useState(false);
  const [initialBodies, setInitialBodies] = useState(defaultState.bodies);
  const [state, setState] = useState<GravitySystemState>(defaultState);
  const [trails, setTrails] = useState<Vector2[][]>(() => initialTrails(defaultState.bodies));
  const [runState, setRunState] = useState<RunState>("idle");
  const [activePreset, setActivePreset] = useState<ThreeBodyPresetId | null>("binary");
  const [stepHours, setStepHours] = useState(defaultPreset.recommendedStep / 3_600);
  const [playbackRate, setPlaybackRate] = useState<(typeof PLAYBACK_RATES)[number]>(50);
  const [keepFullTrails, setKeepFullTrails] = useState(false);
  const [initialEnergy, setInitialEnergy] = useState(() => totalEnergy(defaultState.bodies));
  const [configurationRevision, setConfigurationRevision] = useState(0);
  const [viewOrigin, setViewOrigin] = useState(() => centerOfMass(defaultState.bodies));
  const animationFrame = useRef<number | null>(null);
  const lastFrame = useRef<number | null>(null);
  const accumulator = useRef(0);
  const lastTrailSampleTime = useRef(0);
  const stateRef = useRef(defaultState);

  const energy = totalEnergy(state.bodies);
  const energyDrift = initialEnergy === 0 ? 0 : Math.abs((energy - initialEnergy) / initialEnergy);
  const closestPair = minimumDistance(state.bodies);
  const canDragBodies = runState === "idle" && state.time === 0;

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (runState !== "running") return;
    const integrationStep = Math.max(0.01, Math.min(stepHours, 48)) * 3_600;
    const tick = (now: number) => {
      if (lastFrame.current === null) lastFrame.current = now;
      const realDelta = Math.min((now - lastFrame.current) / 1_000, 0.05);
      lastFrame.current = now;
      accumulator.current += realDelta * playbackRate * DAY;
      accumulator.current = Math.min(accumulator.current, integrationStep * 600);
      let next = stateRef.current;
      let steps = 0;
      const frameTrailSamples: Vector2[][] = [];
      while (accumulator.current >= integrationStep && steps < 600) {
        next = stepGravitySystem(next, integrationStep);
        accumulator.current -= integrationStep;
        steps += 1;
        if (next.time - lastTrailSampleTime.current >= TRAIL_SAMPLE_INTERVAL) {
          frameTrailSamples.push(next.bodies.map((body) => ({ ...body.position })));
          lastTrailSampleTime.current = next.time;
        }
      }
      if (steps > 0) {
        stateRef.current = next;
        setState(next);
        setTrails((current) => next.bodies.map((_, index) => {
          const addedPoints = frameTrailSamples
            .map((sample) => sample[index])
            .filter((point): point is Vector2 => point !== undefined);
          const trail = [...(current[index] ?? []), ...addedPoints];
          return !keepFullTrails && trail.length > MAXIMUM_TRAIL_POINTS
            ? trail.slice(trail.length - MAXIMUM_TRAIL_POINTS)
            : trail;
        }));
      }
      animationFrame.current = requestAnimationFrame(tick);
    };
    animationFrame.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);
      lastFrame.current = null;
    };
  }, [keepFullTrails, playbackRate, runState, stepHours]);

  const installBodies = useCallback((
    bodies: readonly ThreeBody[],
    options: { preserveViewport?: boolean } = {},
  ) => {
    const next = createGravityState(bodies);
    setInitialBodies(next.bodies);
    setState(next);
    stateRef.current = next;
    setTrails(initialTrails(next.bodies));
    setInitialEnergy(totalEnergy(next.bodies));
    setRunState("idle");
    if (!options.preserveViewport) {
      setViewOrigin(centerOfMass(next.bodies));
      setConfigurationRevision((current) => current + 1);
    }
    accumulator.current = 0;
    lastTrailSampleTime.current = 0;
  }, []);

  const reset = useCallback(() => {
    installBodies(initialBodies);
  }, [initialBodies, installBodies]);

  const applyPreset = (presetId: ThreeBodyPresetId) => {
    const preset = THREE_BODY_PRESETS[presetId];
    setActivePreset(presetId);
    setStepHours(preset.recommendedStep / 3_600);
    installBodies(preset.bodies);
  };

  const updateBody = (index: number, field: BodyField, displayedValue: number) => {
    if (!Number.isFinite(displayedValue)) return;
    const next = initialBodies.map((body) => ({
      ...body,
      position: { ...body.position },
      velocity: { ...body.velocity },
    }));
    const body = next[index];
    if (field === "mass") body.mass = Math.min(100, Math.max(0.001, displayedValue)) * SOLAR_MASS;
    if (field === "x") body.position.x = Math.min(100, Math.max(-100, displayedValue)) * ASTRONOMICAL_UNIT;
    if (field === "y") body.position.y = Math.min(100, Math.max(-100, displayedValue)) * ASTRONOMICAL_UNIT;
    if (field === "vx") body.velocity.x = Math.min(1_000, Math.max(-1_000, displayedValue)) * 1_000;
    if (field === "vy") body.velocity.y = Math.min(1_000, Math.max(-1_000, displayedValue)) * 1_000;
    setActivePreset(null);
    installBodies(next, { preserveViewport: true });
  };

  const moveBody = (index: number, position: Vector2) => {
    const next = initialBodies.map((body) => ({
      ...body,
      position: { ...body.position },
      velocity: { ...body.velocity },
    }));
    next[index].position = { ...position };
    setActivePreset(null);
    installBodies(next, { preserveViewport: true });
  };

  const changeBodyVelocity = (index: number, velocity: Vector2) => {
    const next = initialBodies.map((body) => ({
      ...body,
      position: { ...body.position },
      velocity: { ...body.velocity },
    }));
    next[index].velocity = {
      x: Math.min(1_000_000, Math.max(-1_000_000, velocity.x)),
      y: Math.min(1_000_000, Math.max(-1_000_000, velocity.y)),
    };
    setActivePreset(null);
    installBodies(next, { preserveViewport: true });
  };

  const addThirdBody = () => {
    if (initialBodies.length === 3) return;
    setActivePreset(null);
    installBodies([...initialBodies, createThirdBody()]);
  };

  const removeThirdBody = () => {
    if (initialBodies.length === 2) return;
    setActivePreset(null);
    installBodies(initialBodies.slice(0, 2));
  };

  return (
    <main className="app-shell three-body-shell" data-hydrated={hydrated ? "true" : "false"}>
      <header className="topbar">
        <a className="brand" href="/" aria-label="SimuPhys home">
          <span className="brand-mark three-body-brand-mark" aria-hidden="true">S</span>
          <span><strong>GravityLab</strong><small>LABORATOIRE DE MÉCANIQUE CÉLESTE</small></span>
        </a>
        <div className="experiment-nav">
          <a className="back-to-catalog" href="/"><ArrowLeft size={15} aria-hidden="true" /><span>Back to catalog</span></a>
          <div className="experiment-pill"><span className="live-dot" />Expérience 03 <span>•</span> Gravitation à N corps</div>
        </div>
      </header>

      <section className="intro three-body-intro">
        <div>
          <p className="eyebrow"><Sparkles size={15} />À toi de fixer le départ</p>
          <h1>Pose les corps.<br />La gravité fait le reste.</h1>
          <p className="intro-copy">
            Choisis deux ou trois masses, leurs positions et leurs vitesses. À chaque pas,
            le moteur recalcule toutes les attractions puis avance le système — sans trajectoire
            chargée à l’avance et sans instant final imposé.
          </p>
        </div>
        <div className="formula-card three-body-formula-card" aria-label="Boucle de calcul utilisée">
          <span>À CHAQUE PAS Δt</span>
          <strong>positions → <span>forces → vitesses</span></strong>
          <small>{state.bodies.length} corps • calcul en cours jusqu’à ta pause</small>
        </div>
      </section>

      <section className="workspace">
        <div className="simulation-card">
          <div className="scene-heading">
            <div><span className="section-number">01</span><div><p>ESPACE D’OBSERVATION</p><strong>Le futur calculé, pas après pas</strong></div></div>
            <div className={`status status-${runState}`} role="status"><span />{runState === "running" ? "Gravité en calcul" : runState === "paused" ? "En pause" : "Conditions initiales"}</div>
          </div>
          <ThreeBodyCanvas
            key={configurationRevision}
            state={state}
            trails={trails}
            runState={runState}
            canDrag={canDragBodies}
            viewOrigin={viewOrigin}
            onBodyMove={moveBody}
            onVelocityChange={changeBodyVelocity}
          />
          <div className="transport gravity-transport">
            <button className="icon-button" onClick={reset} aria-label="Revenir aux conditions initiales"><RotateCcw size={19} /></button>
            <button className="play-button three-body-play-button" onClick={() => setRunState((current) => current === "running" ? "paused" : "running")}>
              {runState === "running" ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              {runState === "running" ? "Mettre en pause" : state.time > 0 ? "Continuer le calcul" : "Lancer la gravité"}
            </button>
            <div className="speed-control" aria-label="Jours simulés par seconde">
              {PLAYBACK_RATES.map((rate) => <button key={rate} className={playbackRate === rate ? "active" : ""} onClick={() => setPlaybackRate(rate)}>{rate} j/s</button>)}
            </div>
          </div>
        </div>

        <aside className="control-panel three-body-control-panel">
          <div className="panel-title">
            <div><span className="section-number inverse">02</span><div><p>CONFIGURATIONS CONNUES</p><strong>Presets de départ</strong></div></div>
            <Orbit size={20} />
          </div>
          <p className="preset-explanation">Un preset remplit uniquement les masses, positions et vitesses. Ensuite, le même moteur gravitationnel calcule chaque pas.</p>
          <div className="scenario-list" aria-label="Preset gravitationnel">
            {PRESET_IDS.map((id) => {
              const preset = THREE_BODY_PRESETS[id];
              return (
                <button key={id} className={activePreset === id ? "active" : ""} aria-pressed={activePreset === id} onClick={() => applyPreset(id)}>
                  <Orbit size={17} aria-hidden="true" />
                  <span><strong>{preset.name}</strong><small>{preset.description}</small></span>
                </button>
              );
            })}
          </div>
          <label className="step-input">
            <span>Pas de calcul Δt</span>
            <span><input type="number" min={0.01} max={48} step={0.01} value={Number(stepHours.toFixed(3))} aria-label="Pas de calcul en heures" onChange={(event) => setStepHours(Math.max(0.01, Number(event.target.value)))} /> heures</span>
          </label>
          <label className={`trail-mode-control${keepFullTrails ? " active" : ""}`}>
            <span><strong>Trajectoire complète</strong><small>Conserve toute la trace depuis le lancement. La mémoire utilisée augmente avec le temps.</small></span>
            <input
              type="checkbox"
              checked={keepFullTrails}
              disabled={runState !== "idle" || state.time > 0}
              aria-label="Garder tous les points de la trajectoire"
              onChange={(event) => setKeepFullTrails(event.target.checked)}
            />
          </label>
          <div className="ball-preset three-body-model-card">
            <p>IMPORTANT</p><strong>Aucune position future n’est connue</strong>
            <span>Seul l’état courant existe. La trace montre le passé déjà calculé.</span>
          </div>
        </aside>
      </section>

      <section className="body-editor" aria-labelledby="body-editor-title">
        <div className="body-editor-heading">
          <div><p>03 • CONDITIONS INITIALES</p><h2 id="body-editor-title">Construis ton système</h2></div>
          {initialBodies.length === 2 ? (
            <button onClick={addThirdBody}><Plus size={17} />Ajouter un troisième corps</button>
          ) : (
            <button onClick={removeThirdBody}><Trash2 size={17} />Retirer Cygnus</button>
          )}
        </div>
        <div className={`body-editor-grid bodies-${initialBodies.length}`}>
          {initialBodies.map((body, index) => (
            <BodyEditor key={body.id} body={body} index={index} disabled={runState === "running"} onChange={updateBody} />
          ))}
        </div>
        <p className="body-editor-note">Les valeurs saisies sont affichées en masses solaires, unités astronomiques et km/s, puis converties en unités SI par le moteur.</p>
      </section>

      <section className="readouts three-body-readouts">
        <article><div className="metric-heading"><span className="readout-icon orange"><Timer size={19} /></span><p>TEMPS CALCULÉ</p></div><strong>{formatNumber(state.time / DAY, 1)} <small>jours</small></strong><span className="metric-note">Il n’existe aucune durée maximale.</span></article>
        <article><div className="metric-heading"><span className="readout-icon blue"><Activity size={19} /></span><p>DISTANCE MINIMALE</p></div><strong>{formatDistance(closestPair)}</strong><span className="metric-note">Distance actuelle de la paire la plus proche.</span></article>
        <article><div className="metric-heading"><span className="readout-icon violet"><Gauge size={19} /></span><p>DÉRIVE D’ÉNERGIE</p></div><strong>{energyDrift.toExponential(2)}</strong><span className="metric-note">Si elle augmente fortement, réduis le pas Δt.</span></article>
      </section>

      <section className="formula-breakdown">
        <div className="formula-heading"><div><p>04 • CE QUE FAIT LE MOTEUR</p><h2>Il ne connaît que l’instant présent</h2></div><span className="model-badge three-body-model-badge">VELOCITY-VERLET • SI</span></div>
        <div className="formula-columns">
          <article className="equation-card"><p>1. RECALCULER LA GRAVITÉ</p><div className="equation-list"><code>a⃗ᵢ = G Σⱼ≠ᵢ mⱼ(r⃗ⱼ − r⃗ᵢ) / (|r⃗ⱼ − r⃗ᵢ|² + ε²)³ᐟ²</code><code>Chaque corps attire tous les autres.</code></div><span>Le calcul utilise uniquement les positions de ce pas. Aucune formule ne saute directement au jour 500.</span></article>
          <article className="equation-card equation-card-values"><p>2. AVANCER D’UN PETIT PAS</p><div className="equation-list"><code>r⃗(t + Δt) ← r⃗(t), v⃗(t), a⃗(t)</code><code>v⃗(t + Δt) ← a⃗(t), a⃗(t + Δt)</code><code>puis recommencer</code></div><span>Un petit pas donne une meilleure fidélité lors des rencontres proches, au prix de davantage de calculs.</span></article>
        </div>
      </section>

      <section className="insight three-body-insight">
        <span className="insight-mark">?</span>
        <div><p>L’EXPÉRIENCE</p><h2>Le moteur ne sait pas encore ce qui arrivera.</h2><span>Il connaît les lois et l’état actuel. Pour découvrir la suite, il doit effectuer tous les pas intermédiaires — exactement ce qui rend ce problème intéressant.</span></div>
        <div className="chaos-mini-diagram" aria-hidden="true"><i /></div>
      </section>

      <footer><span>GravityLab • Deux ou trois corps libres</span><span>MODÈLE : GRAVITATION NEWTONIENNE • 2D • SANS COLLISION</span></footer>
    </main>
  );
}

type BodyEditorProps = {
  body: ThreeBody;
  index: number;
  disabled: boolean;
  onChange: (index: number, field: BodyField, value: number) => void;
};

function BodyEditor({ body, index, disabled, onChange }: BodyEditorProps) {
  const color = ["orange", "blue", "violet"][index];
  return (
    <article className={`body-editor-card body-editor-${color}`}>
      <div className="body-editor-card-title"><i className={`ball ball-${color}`} /><div><span>CORPS {index + 1}</span><strong>{body.name}</strong></div></div>
      <div className="body-fields">
        <NumericField label="Masse" accessibleLabel={`${body.name} — Masse`} unit="M☉" value={body.mass / SOLAR_MASS} step={0.01} disabled={disabled} onChange={(value) => onChange(index, "mass", value)} />
        <NumericField label="Position X" accessibleLabel={`${body.name} — Position X`} unit="ua" value={body.position.x / ASTRONOMICAL_UNIT} step={0.01} disabled={disabled} onChange={(value) => onChange(index, "x", value)} />
        <NumericField label="Position Y" accessibleLabel={`${body.name} — Position Y`} unit="ua" value={body.position.y / ASTRONOMICAL_UNIT} step={0.01} disabled={disabled} onChange={(value) => onChange(index, "y", value)} />
        <NumericField label="Vitesse X" accessibleLabel={`${body.name} — Vitesse X`} unit="km/s" value={body.velocity.x / 1_000} step={0.1} disabled={disabled} onChange={(value) => onChange(index, "vx", value)} />
        <NumericField label="Vitesse Y" accessibleLabel={`${body.name} — Vitesse Y`} unit="km/s" value={body.velocity.y / 1_000} step={0.1} disabled={disabled} onChange={(value) => onChange(index, "vy", value)} />
      </div>
    </article>
  );
}

type NumericFieldProps = {
  label: string;
  accessibleLabel: string;
  unit: string;
  value: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
};

function NumericField({ label, accessibleLabel, unit, value, step, disabled, onChange }: NumericFieldProps) {
  return (
    <label><span>{label}</span><span><input type="number" step={step} value={Number(value.toFixed(5))} disabled={disabled} aria-label={accessibleLabel} onChange={(event) => onChange(Number(event.target.value))} /><small>{unit}</small></span></label>
  );
}
