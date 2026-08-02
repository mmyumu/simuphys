"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  sampleSpringDrop,
  suspendedSpringLength,
  type SpringDropParameters,
} from "@/lib/spring-drop";

type Props = {
  parameters: SpringDropParameters;
  time: number;
  runState: "idle" | "running" | "paused" | "finished";
};

const COLORS = {
  ink: "#1d2433",
  orange: "#ed6938",
  orangeDark: "#b9431d",
  blue: "#3f76e4",
  blueDark: "#244fa4",
  violet: "#715be3",
  paper: "#faf7f0",
  grid: "rgba(55, 72, 101, 0.10)",
};

export function SpringDropCanvas({ parameters, time, runState }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const springLength = useMemo(
    () => suspendedSpringLength(parameters),
    [parameters],
  );

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
      paintScene(
        context,
        rect.width,
        rect.height,
        parameters,
        time,
        runState,
      );
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [parameters, runState, time]);

  return (
    <div className="canvas-wrap spring-canvas-wrap">
      <canvas
        ref={canvasRef}
        aria-label="Animation comparative d’une balle sous une corde et d’une balle sous un ressort"
        data-wave-state={time === 0 ? "ready" : "travelling"}
        data-run-state={runState}
        data-spring-length={springLength.toFixed(3)}
      />
      <div className="canvas-axis axis-y">HAUTEUR</div>
      <div className="spring-canvas-caption" aria-hidden="true">
        <span>CORDE</span>
        <span>RESSORT MASSIF</span>
      </div>
    </div>
  );
}

function paintScene(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  parameters: SpringDropParameters,
  time: number,
  runState: Props["runState"],
) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = COLORS.paper;
  context.fillRect(0, 0, width, height);

  const sample = sampleSpringDrop(parameters, time);
  const suspendedLength = suspendedSpringLength(parameters);
  const worldTop = parameters.height + suspendedLength + 0.55;
  const groundY = height - 45;
  const topY = 35;
  const scale = (groundY - topY) / worldTop;
  const ropeX = width * 0.31;
  const springX = width * 0.69;
  const ceilingHeight = parameters.height + suspendedLength;
  const toCanvasY = (worldHeight: number) =>
    groundY - Math.max(0, worldHeight) * scale;

  drawGrid(context, width, topY, groundY);
  drawGround(context, width, groundY);
  drawCeiling(context, width, toCanvasY(ceilingHeight));

  const ropeBallY = toCanvasY(sample.ropeBallHeight);
  const springBallY = toCanvasY(sample.springBallHeight);
  const releaseDistance =
    parameters.height - sample.ropeBallHeight;
  const ropeTopHeight = ceilingHeight - releaseDistance;

  if (time === 0) {
    drawHook(context, ropeX, toCanvasY(ceilingHeight));
    drawHook(context, springX, toCanvasY(ceilingHeight));
  } else {
    drawCut(context, ropeX, toCanvasY(ceilingHeight));
    drawCut(context, springX, toCanvasY(ceilingHeight));
  }

  context.strokeStyle = COLORS.orange;
  context.lineWidth = 2.5;
  context.beginPath();
  context.moveTo(ropeX, toCanvasY(ropeTopHeight));
  context.lineTo(ropeX, ropeBallY - 13);
  context.stroke();

  const springPoints = sample.springNodeHeights.map((nodeHeight, index) => ({
    x:
      springX +
      (index === 0 ? 0 : index % 2 === 0 ? -9 : 9),
    y: toCanvasY(nodeHeight),
  }));
  springPoints.push({ x: springX, y: springBallY - 13 });
  drawSpring(context, springPoints, sample.waveProgress);

  if (time > 0 && !sample.ropeImpacted) {
    drawVelocityArrow(
      context,
      ropeX - 23,
      ropeBallY,
      sample.ropeBallSpeed,
      COLORS.orange,
    );
  }
  if (time > 0 && !sample.springImpacted && sample.springBallSpeed > 0.08) {
    drawVelocityArrow(
      context,
      springX + 23,
      springBallY,
      sample.springBallSpeed,
      COLORS.blue,
    );
  }

  if (sample.ropeImpacted) drawImpact(context, ropeX, groundY, COLORS.orange);
  if (sample.springImpacted) drawImpact(context, springX, groundY, COLORS.blue);

  drawBall(context, ropeX, ropeBallY, COLORS.orange, COLORS.orangeDark);
  drawBall(context, springX, springBallY, COLORS.blue, COLORS.blueDark);

  drawBadge(
    context,
    ropeX,
    Math.min(groundY - 24, ropeBallY + 31),
    "CHUTE IMMÉDIATE",
    COLORS.orange,
  );
  drawBadge(
    context,
    springX,
    Math.min(groundY - 24, springBallY + 31),
    time === 0
      ? "SOUS TENSION"
      : sample.waveProgress < 1
        ? "ONDE EN COURS"
        : "LIBÉRÉE",
    COLORS.blue,
  );

  if (runState === "idle") {
    context.fillStyle = COLORS.ink;
    context.font = "600 11px DM Mono, monospace";
    context.textAlign = "center";
    context.fillText("COUPE SIMULTANÉE", width / 2, topY + 9);
  }
}

function drawGrid(
  context: CanvasRenderingContext2D,
  width: number,
  topY: number,
  groundY: number,
) {
  context.strokeStyle = COLORS.grid;
  context.lineWidth = 1;
  for (let y = topY; y < groundY; y += 38) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.setLineDash([3, 6]);
  context.beginPath();
  context.moveTo(width / 2, topY);
  context.lineTo(width / 2, groundY);
  context.stroke();
  context.setLineDash([]);
}

function drawCeiling(
  context: CanvasRenderingContext2D,
  width: number,
  y: number,
) {
  context.fillStyle = COLORS.ink;
  context.fillRect(width * 0.15, y - 8, width * 0.7, 9);
  context.strokeStyle = "rgba(29,36,51,.3)";
  context.lineWidth = 1;
  for (let x = width * 0.15; x < width * 0.85; x += 18) {
    context.beginPath();
    context.moveTo(x, y - 8);
    context.lineTo(x + 9, y - 17);
    context.stroke();
  }
}

function drawGround(
  context: CanvasRenderingContext2D,
  width: number,
  y: number,
) {
  context.fillStyle = COLORS.ink;
  context.fillRect(0, y, width, 3);
  context.fillStyle = "rgba(29,36,51,.07)";
  context.fillRect(0, y + 3, width, 42);
}

function drawHook(context: CanvasRenderingContext2D, x: number, y: number) {
  context.fillStyle = COLORS.ink;
  context.beginPath();
  context.arc(x, y + 3, 4, 0, Math.PI * 2);
  context.fill();
}

function drawCut(context: CanvasRenderingContext2D, x: number, y: number) {
  context.strokeStyle = COLORS.violet;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x - 10, y + 5);
  context.lineTo(x + 10, y + 13);
  context.moveTo(x - 10, y + 13);
  context.lineTo(x + 10, y + 5);
  context.stroke();
}

function drawSpring(
  context: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  waveProgress: number,
) {
  if (points.length < 2) return;
  const waveIndex = Math.round(waveProgress * (points.length - 1));
  context.lineWidth = 2.2;
  context.lineJoin = "round";

  for (let index = 1; index < points.length; index += 1) {
    context.strokeStyle =
      index <= waveIndex ? COLORS.violet : COLORS.blue;
    context.beginPath();
    context.moveTo(points[index - 1].x, points[index - 1].y);
    context.lineTo(points[index].x, points[index].y);
    context.stroke();
  }
}

function drawBall(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  shadow: string,
) {
  const gradient = context.createRadialGradient(x - 4, y - 5, 1, x, y, 14);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.18, color);
  gradient.addColorStop(1, shadow);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, 13, 0, Math.PI * 2);
  context.fill();
}

function drawVelocityArrow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  speed: number,
  color: string,
) {
  const length = Math.min(54, 12 + speed * 4);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, y - 5);
  context.lineTo(x, y + length);
  context.stroke();
  context.beginPath();
  context.moveTo(x, y + length);
  context.lineTo(x - 4, y + length - 8);
  context.lineTo(x + 4, y + length - 8);
  context.closePath();
  context.fill();
}

function drawImpact(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) {
  context.strokeStyle = color;
  context.lineWidth = 2;
  for (let index = 0; index < 6; index += 1) {
    const angle = Math.PI + (Math.PI * index) / 5;
    context.beginPath();
    context.moveTo(x + Math.cos(angle) * 17, y + Math.sin(angle) * 7);
    context.lineTo(x + Math.cos(angle) * 27, y + Math.sin(angle) * 13);
    context.stroke();
  }
}

function drawBadge(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  color: string,
) {
  context.font = "600 8px DM Mono, monospace";
  const badgeWidth = context.measureText(label).width + 13;
  context.fillStyle = "rgba(250,247,240,.9)";
  context.fillRect(x - badgeWidth / 2, y - 10, badgeWidth, 18);
  context.fillStyle = color;
  context.textAlign = "center";
  context.fillText(label, x, y + 2);
}
