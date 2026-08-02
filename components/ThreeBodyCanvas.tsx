"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ASTRONOMICAL_UNIT,
  type GravitySystemState,
  type Vector2,
} from "@/lib/three-body";

type Props = {
  state: GravitySystemState;
  trails: Vector2[][];
  runState: "idle" | "running" | "paused";
  canDrag: boolean;
  viewOrigin: Vector2;
  onBodyMove: (bodyIndex: number, position: Vector2) => void;
};

type DragState = {
  bodyIndex: number;
  position: Vector2;
};

const COLORS = ["#ed6938", "#3f76e4", "#715be3"] as const;
const DARK_COLORS = ["#a83c18", "#244fa4", "#4d3cac"] as const;

export function ThreeBodyCanvas({
  state,
  trails,
  runState,
  canDrag,
  viewOrigin,
  onBodyMove,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maximumRadius = useRef(0.75 * ASTRONOMICAL_UNIT);
  const dragStateRef = useRef<DragState | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const requiredRadius = state.bodies.reduce(
    (maximum, body) => Math.max(
      maximum,
      Math.hypot(body.position.x - viewOrigin.x, body.position.y - viewOrigin.y),
    ),
    0.75 * ASTRONOMICAL_UNIT,
  );
  maximumRadius.current = Math.max(maximumRadius.current, requiredRadius * 1.18);
  const viewport = { center: viewOrigin, radius: maximumRadius.current };
  const displayedState = dragState === null
    ? state
    : {
        ...state,
        bodies: state.bodies.map((body, index) =>
          index === dragState.bodyIndex
            ? { ...body, position: dragState.position }
            : body,
        ),
      };

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
      const gridStep = paintScene(
        context,
        rect.width,
        rect.height,
        displayedState,
        trails,
        viewport,
        runState,
      );
      canvas.dataset.gridStepAu = (gridStep / ASTRONOMICAL_UNIT).toFixed(6);
      const scale = Math.min(rect.width, rect.height) * 0.43 / viewport.radius;
      canvas.dataset.bodyScreenPositions = JSON.stringify(
        displayedState.bodies.map((body) => ({
          x: rect.width / 2 + (body.position.x - viewport.center.x) * scale,
          y: rect.height / 2 - (body.position.y - viewport.center.y) * scale,
        })),
      );
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [displayedState, runState, trails, viewport]);

  const pointerPosition = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      screen: {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      },
      rect,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canDrag) return;
    const { screen, rect } = pointerPosition(event);
    const scale = Math.min(rect.width, rect.height) * 0.43 / viewport.radius;
    const bodyIndex = nearestBody(state, screen, rect.width, rect.height, viewport, scale);
    if (bodyIndex === null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextDrag = { bodyIndex, position: { ...state.bodies[bodyIndex].position } };
    dragStateRef.current = nextDrag;
    setDragState(nextDrag);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragStateRef.current === null) return;
    const { screen, rect } = pointerPosition(event);
    const scale = Math.min(rect.width, rect.height) * 0.43 / viewport.radius;
    const nextDrag = {
      bodyIndex: dragStateRef.current.bodyIndex,
      position: {
        x: viewport.center.x + (screen.x - rect.width / 2) / scale,
        y: viewport.center.y - (screen.y - rect.height / 2) / scale,
      },
    };
    dragStateRef.current = nextDrag;
    setDragState(nextDrag);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const completedDrag = dragStateRef.current;
    if (completedDrag === null) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStateRef.current = null;
    setDragState(null);
    onBodyMove(completedDrag.bodyIndex, completedDrag.position);
  };

  const handlePointerCancel = () => {
    dragStateRef.current = null;
    setDragState(null);
  };

  return (
    <div className="canvas-wrap three-body-canvas-wrap">
      <canvas
        ref={canvasRef}
        aria-label="Simulation gravitationnelle pas à pas de deux ou trois corps ; corps déplaçables avant le lancement"
        data-run-state={runState}
        data-draggable={canDrag ? "true" : "false"}
        data-dragging-body={dragState === null ? "" : state.bodies[dragState.bodyIndex].id}
        data-body-count={state.bodies.length}
        data-time-days={(state.time / 86_400).toFixed(3)}
        data-camera-x-au={(viewOrigin.x / ASTRONOMICAL_UNIT).toFixed(6)}
        data-camera-y-au={(viewOrigin.y / ASTRONOMICAL_UNIT).toFixed(6)}
        data-view-radius-au={(viewport.radius / ASTRONOMICAL_UNIT).toFixed(6)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />
      <div className="canvas-axis axis-y">Y • UNITÉS ASTRONOMIQUES</div>
      <div className="canvas-axis axis-x">X • UNITÉS ASTRONOMIQUES</div>
      <div className="three-body-reference-label">RÉFÉRENTIEL : CENTRE DE MASSE INITIAL</div>
      {canDrag && (
        <div className="three-body-drag-hint">GLISSE LES CORPS POUR LES REPOSITIONNER</div>
      )}
      {runState === "paused" && (
        <div className="three-body-drag-hint">RÉINITIALISE POUR MODIFIER LES POSITIONS</div>
      )}
      <div className="three-body-canvas-key" aria-hidden="true">
        {state.bodies.map((body, index) => (
          <span key={body.id}><i style={{ borderColor: COLORS[index] }} /> {body.name}</span>
        ))}
      </div>
    </div>
  );
}

function nearestBody(
  state: GravitySystemState,
  pointer: Vector2,
  width: number,
  height: number,
  viewport: { center: Vector2; radius: number },
  scale: number,
) {
  let nearest: number | null = null;
  let nearestDistance = 24;
  state.bodies.forEach((body, index) => {
    const x = width / 2 + (body.position.x - viewport.center.x) * scale;
    const y = height / 2 - (body.position.y - viewport.center.y) * scale;
    const distance = Math.hypot(pointer.x - x, pointer.y - y);
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  });
  return nearest;
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
  const scale = Math.min(width, height) * 0.43 / viewport.radius;
  const project = (point: Vector2) => ({
    x: width / 2 + (point.x - viewport.center.x) * scale,
    y: height / 2 - (point.y - viewport.center.y) * scale,
  });
  const gridStep = niceScaleStep(58 / scale);
  drawGrid(context, width, height, viewport.center, scale, gridStep);
  drawScaleBar(context, scale, gridStep);

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
  return gridStep;
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

function drawGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  center: Vector2,
  scale: number,
  step: number,
) {
  context.strokeStyle = "rgba(55, 72, 101, 0.09)";
  context.lineWidth = 1;
  const left = center.x - width / (2 * scale);
  const right = center.x + width / (2 * scale);
  const bottom = center.y - height / (2 * scale);
  const top = center.y + height / (2 * scale);
  for (let worldX = Math.ceil(left / step) * step; worldX <= right; worldX += step) {
    const x = width / 2 + (worldX - center.x) * scale;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let worldY = Math.ceil(bottom / step) * step; worldY <= top; worldY += step) {
    const y = height / 2 - (worldY - center.y) * scale;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
}

function drawScaleBar(
  context: CanvasRenderingContext2D,
  scale: number,
  step: number,
) {
  const barWidth = step * scale;
  const x = 16;
  const y = 24;
  context.fillStyle = "rgba(255, 253, 248, 0.88)";
  context.fillRect(8, 8, Math.max(94, barWidth + 32), 38);
  context.strokeStyle = "rgba(29, 36, 51, 0.72)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + barWidth, y);
  context.moveTo(x, y - 4);
  context.lineTo(x, y + 4);
  context.moveTo(x + barWidth, y - 4);
  context.lineTo(x + barWidth, y + 4);
  context.stroke();
  context.fillStyle = "rgba(29, 36, 51, 0.72)";
  context.font = "600 8px DM Mono, monospace";
  context.textAlign = "left";
  context.fillText(formatScale(step), x, y + 15);
  context.textAlign = "start";
}

function niceScaleStep(target: number) {
  if (!Number.isFinite(target) || target <= 0) return ASTRONOMICAL_UNIT;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const normalized = target / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
}

function formatScale(distance: number) {
  const astronomicalUnits = distance / ASTRONOMICAL_UNIT;
  if (astronomicalUnits >= 0.01) {
    return `${astronomicalUnits.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ua`;
  }
  return `${Math.round(distance / 1_000).toLocaleString("fr-FR")} km`;
}
