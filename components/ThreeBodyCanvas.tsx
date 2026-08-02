"use client";

import { useEffect, useRef } from "react";
import {
  ASTRONOMICAL_UNIT,
  type GravitySystemState,
  type Vector2,
} from "@/lib/three-body";

type Props = {
  state: GravitySystemState;
  trails: Vector2[][];
  runState: "idle" | "running" | "paused";
  viewOrigin: Vector2;
};

const COLORS = ["#ed6938", "#3f76e4", "#715be3"] as const;
const DARK_COLORS = ["#a83c18", "#244fa4", "#4d3cac"] as const;

export function ThreeBodyCanvas({ state, trails, runState, viewOrigin }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maximumRadius = useRef(0.75 * ASTRONOMICAL_UNIT);
  const requiredRadius = state.bodies.reduce(
    (maximum, body) => Math.max(
      maximum,
      Math.hypot(body.position.x - viewOrigin.x, body.position.y - viewOrigin.y),
    ),
    0.75 * ASTRONOMICAL_UNIT,
  );
  maximumRadius.current = Math.max(maximumRadius.current, requiredRadius * 1.18);
  const viewport = { center: viewOrigin, radius: maximumRadius.current };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(ratio, ratio);
      paintScene(context, rect.width, rect.height, state, trails, viewport, runState);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [runState, state, trails, viewport]);

  return (
    <div className="canvas-wrap three-body-canvas-wrap">
      <canvas
        ref={canvasRef}
        aria-label="Simulation gravitationnelle pas à pas de deux ou trois corps"
        data-run-state={runState}
        data-body-count={state.bodies.length}
        data-time-days={(state.time / 86_400).toFixed(3)}
        data-camera-x-au={(viewOrigin.x / ASTRONOMICAL_UNIT).toFixed(6)}
        data-camera-y-au={(viewOrigin.y / ASTRONOMICAL_UNIT).toFixed(6)}
        data-view-radius-au={(viewport.radius / ASTRONOMICAL_UNIT).toFixed(6)}
      />
      <div className="canvas-axis axis-y">Y • UNITÉS ASTRONOMIQUES</div>
      <div className="canvas-axis axis-x">X • UNITÉS ASTRONOMIQUES</div>
      <div className="three-body-reference-label">RÉFÉRENTIEL : CENTRE DE MASSE INITIAL</div>
      <div className="three-body-canvas-key" aria-hidden="true">
        {state.bodies.map((body, index) => (
          <span key={body.id}><i style={{ borderColor: COLORS[index] }} /> {body.name}</span>
        ))}
      </div>
    </div>
  );
}

function paintScene(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: GravitySystemState,
  trails: Vector2[][],
  viewport: { center: Vector2; radius: number },
  runState: Props["runState"],
) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#faf7f0";
  context.fillRect(0, 0, width, height);
  drawGrid(context, width, height);
  const scale = Math.min(width, height) * 0.43 / viewport.radius;
  const project = (point: Vector2) => ({
    x: width / 2 + (point.x - viewport.center.x) * scale,
    y: height / 2 - (point.y - viewport.center.y) * scale,
  });

  trails.forEach((trail, bodyIndex) => {
    if (trail.length < 2) return;
    context.strokeStyle = COLORS[bodyIndex];
    context.globalAlpha = 0.72;
    context.lineWidth = 1.7;
    context.beginPath();
    trail.forEach((point, index) => {
      const projected = project(point);
      if (index === 0) context.moveTo(projected.x, projected.y);
      else context.lineTo(projected.x, projected.y);
    });
    context.stroke();
    context.globalAlpha = 1;
  });

  state.bodies.forEach((body, index) => {
    const point = project(body.position);
    const radius = 9 + Math.min(5, body.mass / 5e29);
    const gradient = context.createRadialGradient(point.x - 3, point.y - 3, 1, point.x, point.y, radius);
    gradient.addColorStop(0, "#fffdf8");
    gradient.addColorStop(0.22, COLORS[index]);
    gradient.addColorStop(1, DARK_COLORS[index]);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
    drawBodyLabel(context, point, body.name, COLORS[index]);
    if (runState !== "running") drawVelocityArrow(context, point, body.velocity, COLORS[index]);
  });

  const center = project(viewport.center);
  context.strokeStyle = "rgba(29,36,51,.42)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(center.x - 5, center.y);
  context.lineTo(center.x + 5, center.y);
  context.moveTo(center.x, center.y - 5);
  context.lineTo(center.x, center.y + 5);
  context.stroke();
}

function drawBodyLabel(
  context: CanvasRenderingContext2D,
  point: Vector2,
  name: string,
  color: string,
) {
  context.fillStyle = color;
  context.font = "600 8px DM Mono, monospace";
  context.textAlign = "center";
  context.fillText(name.toLocaleUpperCase("fr"), point.x, point.y + 25);
}

function drawVelocityArrow(
  context: CanvasRenderingContext2D,
  point: Vector2,
  velocity: Vector2,
  color: string,
) {
  const magnitude = Math.hypot(velocity.x, velocity.y);
  if (magnitude < 1) return;
  const length = Math.min(38, 15 + magnitude / 2_000);
  const x = velocity.x / magnitude * length;
  const y = -velocity.y / magnitude * length;
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(point.x, point.y);
  context.lineTo(point.x + x, point.y + y);
  context.stroke();
  context.beginPath();
  context.arc(point.x + x, point.y + y, 2.5, 0, Math.PI * 2);
  context.fill();
}

function drawGrid(context: CanvasRenderingContext2D, width: number, height: number) {
  context.strokeStyle = "rgba(55, 72, 101, 0.09)";
  context.lineWidth = 1;
  for (let x = width / 2 % 42; x < width; x += 42) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = height / 2 % 42; y < height; y += 42) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}
