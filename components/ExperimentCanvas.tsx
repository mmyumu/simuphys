"use client";

import { useEffect, useRef } from "react";
import {
  DEFAULT_PARAMETERS,
  impactDistance,
  sampleSimulation,
  trajectorySamples,
  type SimulationParameters,
} from "@/lib/physics";

type Props = {
  parameters: SimulationParameters;
  time: number;
  runState: "idle" | "running" | "paused" | "finished";
};

type Point = { x: number; y: number };

const DEFAULT_IMPACT_DISTANCE =
  impactDistance(DEFAULT_PARAMETERS);
const DEFAULT_CAMERA_HEIGHT = DEFAULT_PARAMETERS.height * 1.12;
const MIN_ILLUSTRATION_SCALE = 0.58;

const COLORS = {
  ink: "#1d2433",
  orange: "#f16e3a",
  orangeDark: "#bd4420",
  blue: "#3f76e4",
  blueDark: "#2552aa",
  violet: "#715be3",
  grid: "rgba(55, 72, 101, 0.10)",
  paper: "#f8f4ec",
};

export function ExperimentCanvas({ parameters, time, runState }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camera = getCamera(parameters);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      paintScene(ctx, rect.width, rect.height, parameters, time, runState);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [parameters, runState, time]);

  return (
    <div className="canvas-wrap">
      <canvas
        ref={canvasRef}
        aria-label="Animation des deux balles en chute libre"
        data-camera-zoom={camera.zoom.toFixed(3)}
        data-camera-mode="isotropic"
        data-launch-angle={parameters.launchAngle}
      />
      <div className="canvas-axis axis-y">HAUTEUR (m)</div>
      <div className="canvas-axis axis-x">DISTANCE (m)</div>
    </div>
  );
}

function paintScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  parameters: SimulationParameters,
  time: number,
  runState: Props["runState"],
) {
  ctx.clearRect(0, 0, width, height);
  const groundY = height - 48;
  const topY = 42;
  const leftX = Math.max(82, width * 0.12);
  const rightPad = 44;
  const camera = getCamera(parameters);
  const illustrationScale = Math.max(
    MIN_ILLUSTRATION_SCALE,
    1 / camera.zoom,
  );
  const availableWidth = width - leftX - rightPad;
  const availableHeight = groundY - topY;
  const worldScale = Math.min(
    availableWidth / camera.maxDistance,
    availableHeight / camera.maxHeight,
  );
  const visibleDistance = availableWidth / worldScale;
  const visibleHeight = availableHeight / worldScale;
  const launchY = groundY - parameters.height * worldScale;
  const current = sampleSimulation(parameters, time);

  drawAtmosphere(ctx, width, topY, groundY);
  drawGround(ctx, width, groundY, illustrationScale);
  drawGrid(
    ctx,
    width,
    height,
    leftX,
    groundY,
    topY,
    visibleHeight,
    visibleDistance,
  );
  drawPlatform(ctx, leftX, groundY, launchY, illustrationScale);
  drawPerson(
    ctx,
    leftX - 22 * illustrationScale,
    launchY - 13 * illustrationScale,
    illustrationScale,
  );
  const worldToCanvas = (point: Point): Point => ({
    x: leftX + point.x * worldScale,
    y: groundY - point.y * worldScale,
  });

  const samples = trajectorySamples(parameters, time);
  drawTrajectory(
    ctx,
    samples.map((sample) => worldToCanvas(sample.dropped)),
    COLORS.orange,
    true,
    illustrationScale,
  );
  drawTrajectory(
    ctx,
    samples.map((sample) => worldToCanvas(sample.launched)),
    COLORS.blue,
    false,
    illustrationScale,
  );

  const dropped = worldToCanvas(current.dropped);
  const launched = worldToCanvas(current.launched);
  const overlap =
    Math.abs(dropped.x - launched.x) < 14 * illustrationScale;

  if (
    time > 0 &&
    runState !== "finished" &&
    !current.launchedImpacted
  ) {
    const launchedSpeed = Math.hypot(
      current.launched.vx,
      current.launched.vy,
    );
    const arrowLength = Math.min(58, 18 + launchedSpeed * 1.25);
    drawVelocityArrow(
      ctx,
      launched.x,
      launched.y,
      launchedSpeed > 0
        ? (current.launched.vx / launchedSpeed) * arrowLength
        : 0,
      launchedSpeed > 0
        ? (current.launched.vy / launchedSpeed) * arrowLength
        : 0,
      COLORS.blue,
      `v = ${launchedSpeed.toFixed(1)} m/s`,
      "above",
      illustrationScale,
    );
  }

  if (
    time > 0 &&
    runState !== "finished" &&
    !current.droppedImpacted
  ) {
    drawVelocityArrow(
      ctx,
      dropped.x - 11,
      dropped.y,
      0,
      Math.min(66, 15 + current.dropped.vy * 1.15),
      COLORS.violet,
      `vᵧ = ${current.dropped.vy.toFixed(1)} m/s`,
      "left",
      illustrationScale,
    );
  }

  if (current.droppedImpacted) {
    drawImpact(ctx, dropped.x, groundY, COLORS.orange, illustrationScale);
  }
  if (current.launchedImpacted) {
    drawImpact(ctx, launched.x, groundY, COLORS.blue, illustrationScale);
  }

  drawBall(
    ctx,
    dropped.x - (overlap ? 7 * illustrationScale : 0),
    dropped.y,
    COLORS.orange,
    COLORS.orangeDark,
    illustrationScale,
  );
  drawBall(
    ctx,
    launched.x + (overlap ? 7 * illustrationScale : 0),
    launched.y,
    COLORS.blue,
    COLORS.blueDark,
    illustrationScale,
  );
  drawLaunchAngleIndicator(
    ctx,
    leftX,
    launchY,
    parameters.launchAngle,
  );

  drawLabel(
    ctx,
    dropped.x - 44 * illustrationScale,
    dropped.y - 32 * illustrationScale,
    "LÂCHÉE",
    COLORS.orange,
    illustrationScale,
  );
  drawLabel(
    ctx,
    Math.min(
      launched.x + 12 * illustrationScale,
      width - 88 * illustrationScale,
    ),
    launched.y - 32 * illustrationScale,
    "LANCÉE",
    COLORS.blue,
    illustrationScale,
  );

  ctx.fillStyle = COLORS.ink;
  ctx.font = `${Math.max(8, 11 * illustrationScale)}px system-ui, sans-serif`;
  ctx.fillText(`${parameters.height.toFixed(0)} m`, 27, launchY + 4);
  ctx.fillStyle = "rgba(29,36,51,.45)";
  ctx.fillText("0", 39, groundY + 4);
  drawScaleMarker(ctx, width, topY, worldScale);
}

function drawLaunchAngleIndicator(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angleDegrees: number,
) {
  const angle = (angleDegrees * Math.PI) / 180;
  const arrowLength = 64;
  const arrowX = Math.cos(angle) * arrowLength;
  const arrowY = -Math.sin(angle) * arrowLength;
  const arcRadius = 23;

  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgba(29,36,51,.38)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(72, 0);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.strokeStyle = COLORS.blueDark;
  ctx.fillStyle = COLORS.blueDark;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(arrowX, arrowY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(arrowX, arrowY);
  ctx.lineTo(
    arrowX - 9 * Math.cos(-angle - Math.PI / 6),
    arrowY - 9 * Math.sin(-angle - Math.PI / 6),
  );
  ctx.lineTo(
    arrowX - 9 * Math.cos(-angle + Math.PI / 6),
    arrowY - 9 * Math.sin(-angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();

  if (angleDegrees !== 0) {
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, arcRadius, 0, -angle, angleDegrees > 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const labelX = arrowX + 8;
  const labelY = angleDegrees >= 60 ? arrowY + 4 : arrowY - 24;
  const label = `${angleDegrees.toFixed(0)}°`;
  ctx.font = "700 10px system-ui, sans-serif";
  const labelWidth = ctx.measureText(label).width;
  ctx.fillStyle = "rgba(248,244,236,.94)";
  ctx.strokeStyle = `${COLORS.blue}66`;
  ctx.lineWidth = 1;
  roundRect(ctx, labelX - 5, labelY, labelWidth + 10, 20, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.blueDark;
  ctx.fillText(label, labelX, labelY + 14);

  ctx.restore();
}

/**
 * The camera reserves enough physical space for the complete experiment.
 * Its single metre-to-pixel scale preserves angles and trajectory geometry.
 */
export function getCamera(parameters: SimulationParameters) {
  const distance = impactDistance(parameters);
  const angle = (parameters.launchAngle * Math.PI) / 180;
  const upwardSpeed = Math.max(
    0,
    parameters.horizontalSpeed * Math.sin(angle),
  );
  const vacuumApex =
    parameters.height + upwardSpeed ** 2 / (2 * parameters.gravity);
  const maxDistance = Math.max(8, distance * 1.12);
  const maxHeight = Math.max(
    8,
    parameters.height + 4,
    vacuumApex * 1.12,
  );
  const zoom = Math.max(
    1,
    maxDistance / Math.max(8, DEFAULT_IMPACT_DISTANCE * 1.12),
    maxHeight / DEFAULT_CAMERA_HEIGHT,
  );

  return {
    maxDistance,
    maxHeight,
    zoom,
  };
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  leftX: number,
  groundY: number,
  topY: number,
  maxHeight: number,
  maxDistance: number,
) {
  ctx.save();
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 5]);

  for (let i = 0; i <= 5; i += 1) {
    const y = topY + ((groundY - topY) * i) / 5;
    ctx.beginPath();
    ctx.moveTo(38, y);
    ctx.lineTo(width - 20, y);
    ctx.stroke();
    if (i > 0 && i < 5) {
      ctx.fillStyle = "rgba(29,36,51,.35)";
      ctx.font = "500 9px system-ui, sans-serif";
      ctx.fillText(
        `${Math.round(maxHeight * (1 - i / 5))}`,
        40,
        y - 5,
      );
    }
  }

  for (let i = 0; i <= 6; i += 1) {
    const x = leftX + ((width - leftX - 35) * i) / 6;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, groundY);
    ctx.stroke();
    if (i > 0) {
      ctx.fillStyle = "rgba(29,36,51,.35)";
      ctx.font = "500 9px system-ui, sans-serif";
      ctx.fillText(
        `${Math.round((maxDistance * i) / 6)}`,
        x - 5,
        groundY + 21,
      );
    }
  }
  ctx.restore();
}

function drawAtmosphere(
  ctx: CanvasRenderingContext2D,
  width: number,
  topY: number,
  groundY: number,
) {
  const gradient = ctx.createLinearGradient(0, topY, 0, groundY);
  gradient.addColorStop(0, "rgba(223,235,246,.44)");
  gradient.addColorStop(1, "rgba(248,244,236,.06)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, topY, width, groundY - topY);

  ctx.save();
  ctx.strokeStyle = "rgba(89,116,142,.12)";
  ctx.lineWidth = 1.5;
  for (const [x, y, size] of [
    [0.37, 0.20, 18],
    [0.68, 0.34, 24],
    [0.86, 0.15, 14],
  ]) {
    ctx.beginPath();
    ctx.arc(width * x, topY + (groundY - topY) * y, size, Math.PI, 0);
    ctx.arc(width * x + size * 1.3, topY + (groundY - topY) * y, size * 0.72, Math.PI, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGround(
  ctx: CanvasRenderingContext2D,
  width: number,
  groundY: number,
  illustrationScale: number,
) {
  ctx.save();
  ctx.fillStyle = "#dce2c7";
  ctx.fillRect(0, groundY, width, 48);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(width, groundY);
  ctx.stroke();
  ctx.strokeStyle = "rgba(45,62,42,.25)";
  ctx.lineWidth = 1;
  const tickSpacing = Math.max(5, 18 * illustrationScale);
  for (let x = 8; x < width; x += tickSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, groundY + 8);
    ctx.lineTo(x + 7 * illustrationScale, groundY);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlatform(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  topY: number,
  illustrationScale: number,
) {
  ctx.save();
  ctx.strokeStyle = COLORS.ink;
  ctx.fillStyle = "#ece4d4";
  ctx.lineWidth = Math.max(1, 2 * illustrationScale);
  const towerWidth = 46 * illustrationScale;
  const topOffset = 11 * illustrationScale;
  ctx.fillRect(x - towerWidth + 2 * illustrationScale, topY + topOffset, towerWidth, groundY - topY - topOffset);
  ctx.strokeRect(x - towerWidth + 2 * illustrationScale, topY + topOffset, towerWidth, groundY - topY - topOffset);
  ctx.beginPath();
  ctx.moveTo(x - 55 * illustrationScale, topY + topOffset);
  ctx.lineTo(x + 13 * illustrationScale, topY + topOffset);
  ctx.stroke();
  ctx.globalAlpha = 0.18;
  const floorSpacing = Math.max(8, 26 * illustrationScale);
  for (
    let y = topY + 36 * illustrationScale;
    y < groundY;
    y += floorSpacing
  ) {
    ctx.beginPath();
    ctx.moveTo(x - 43 * illustrationScale, y);
    ctx.lineTo(x + illustrationScale, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPerson(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  illustrationScale: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(illustrationScale, illustrationScale);
  ctx.strokeStyle = COLORS.ink;
  ctx.fillStyle = "#ffd1aa";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, -12, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(0, 15);
  ctx.moveTo(0, 2);
  ctx.lineTo(18, 4);
  ctx.moveTo(0, 15);
  ctx.lineTo(-7, 28);
  ctx.moveTo(0, 15);
  ctx.lineTo(8, 28);
  ctx.stroke();
  ctx.restore();
}

function drawScaleMarker(
  ctx: CanvasRenderingContext2D,
  width: number,
  topY: number,
  worldScale: number,
) {
  const targetMetres = 72 / worldScale;
  const magnitude = 10 ** Math.floor(Math.log10(targetMetres));
  const normalized = targetMetres / magnitude;
  const multiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : 5;
  const unit = multiplier * magnitude;
  const markerLength = unit * worldScale;
  const panelWidth = Math.max(172, markerLength + 58);
  const panelHeight = markerLength + 42;
  const x = width - panelWidth - 18;
  const y = topY + 8;

  ctx.save();
  ctx.fillStyle = "rgba(248,244,236,.9)";
  ctx.strokeStyle = "rgba(29,36,51,.18)";
  roundRect(ctx, x, y, panelWidth, panelHeight, 6);
  ctx.fill();

  const originX = x + 18;
  const originY = y + panelHeight - 14;
  ctx.strokeStyle = COLORS.blueDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(originX, originY - markerLength);
  ctx.lineTo(originX, originY);
  ctx.lineTo(originX + markerLength, originY);
  ctx.stroke();
  ctx.fillStyle = COLORS.blueDark;
  ctx.font = "700 9px system-ui, sans-serif";
  ctx.fillText(`${unit} m`, originX + markerLength + 5, originY + 3);
  ctx.fillText(`${unit} m`, originX - 6, originY - markerLength - 5);
  ctx.fillStyle = "rgba(29,36,51,.5)";
  ctx.font = "600 8px system-ui, sans-serif";
  ctx.fillText("MÊME ÉCHELLE X = Y", x + 9, y + 12);
  ctx.restore();
}

function drawTrajectory(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  dashed: boolean,
  illustrationScale: number,
) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.58;
  ctx.lineWidth = Math.max(1, 2 * illustrationScale);
  if (dashed) {
    ctx.setLineDash([4 * illustrationScale, 7 * illustrationScale]);
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.stroke();
  ctx.restore();
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  dark: string,
  illustrationScale: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(illustrationScale, illustrationScale);
  ctx.shadowColor = "rgba(29,36,51,.20)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  const gradient = ctx.createRadialGradient(-3, -4, 1, 0, 0, 10);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.18, color);
  gradient.addColorStop(1, dark);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
  illustrationScale: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(illustrationScale, illustrationScale);
  ctx.font = "700 9px system-ui, sans-serif";
  const textWidth = ctx.measureText(text).width;
  ctx.fillStyle = "rgba(248,244,236,.92)";
  ctx.strokeStyle = `${color}55`;
  ctx.lineWidth = 1;
  roundRect(ctx, 0, 0, textWidth + 14, 20, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(text, 7, 13);
  ctx.restore();
}

function drawVelocityArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  color: string,
  label: string,
  labelPosition: "above" | "left",
  illustrationScale: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(illustrationScale, illustrationScale);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(dx, dy);
  ctx.stroke();
  const angle = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(dx, dy);
  ctx.lineTo(
    dx - 8 * Math.cos(angle - Math.PI / 6),
    dy - 8 * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    dx - 8 * Math.cos(angle + Math.PI / 6),
    dy - 8 * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
  ctx.font = "700 9px system-ui, sans-serif";
  ctx.fillText(
    label,
    labelPosition === "above" ? 10 : -27,
    labelPosition === "above" ? -8 : dy / 2,
  );
  ctx.restore();
}

function drawImpact(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  illustrationScale: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(illustrationScale, illustrationScale);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.65;
  for (let angle = Math.PI; angle < Math.PI * 2; angle += Math.PI / 5) {
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 14, Math.sin(angle) * 10);
    ctx.lineTo(Math.cos(angle) * 26, Math.sin(angle) * 21);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}
