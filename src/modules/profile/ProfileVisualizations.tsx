import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  curveLinearClosed,
  curveMonotoneX,
  line as d3Line,
  lineRadial,
  scaleLinear,
  scalePoint
} from "d3";
import type { AbilityProfileData, TrainingHistoryItem } from "../../shared/api/profile";

export type AbilityMetricKey = keyof AbilityProfileData;

export const ABILITY_METRIC_ORDER: AbilityMetricKey[] = [
  "mobility",
  "stability",
  "strength",
  "power",
  "endurance",
  "speed"
];

export const ABILITY_METRIC_LABELS: Record<AbilityMetricKey, string> = {
  mobility: "Mobility",
  stability: "Stability",
  strength: "Strength",
  power: "Power",
  endurance: "Endurance",
  speed: "Speed"
};

const ABILITY_METRIC_COLORS: Record<AbilityMetricKey, string> = {
  mobility: "#4edea3",
  stability: "#f87171",
  strength: "#a3a3a3",
  power: "#38bdf8",
  endurance: "#f59e0b",
  speed: "#c084fc"
};

type RadarDatum = {
  key: AbilityMetricKey;
  label: string;
  angle: number;
  current: number;
  target: number;
};

type DualRadarChartProps = {
  current: AbilityProfileData;
  target: AbilityProfileData;
};

export function DualRadarChart({ current, target }: DualRadarChartProps) {
  const width = 420;
  const height = 380;
  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = 130;
  const radiusScale = scaleLinear().domain([0, 100]).range([0, outerRadius]);

  const data = useMemo<RadarDatum[]>(
    () =>
      ABILITY_METRIC_ORDER.map((key, index) => ({
        key,
        label: ABILITY_METRIC_LABELS[key],
        angle: (index / ABILITY_METRIC_ORDER.length) * Math.PI * 2,
        current: current[key],
        target: target[key]
      })),
    [current, target]
  );

  const radialCurrent = lineRadial<RadarDatum>()
    .angle((d) => d.angle)
    .radius((d) => radiusScale(d.current))
    .curve(curveLinearClosed);
  const radialTarget = lineRadial<RadarDatum>()
    .angle((d) => d.angle)
    .radius((d) => radiusScale(d.target))
    .curve(curveLinearClosed);

  const currentPath = radialCurrent(data) ?? "";
  const targetPath = radialTarget(data) ?? "";

  const getAxisPoint = (angle: number, radius: number) => ({
    x: centerX + Math.cos(angle - Math.PI / 2) * radius,
    y: centerY + Math.sin(angle - Math.PI / 2) * radius
  });

  const ringTicks = [20, 40, 60, 80, 100];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
          Ability Shape: Current vs Goal
        </h3>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.16em]">
          <span className="inline-flex items-center gap-1 text-zinc-300">
            <span className="h-2 w-2 rounded-full bg-[#4edea3]" />
            Current
          </span>
          <span className="inline-flex items-center gap-1 text-sky-200">
            <span className="h-2 w-2 rounded-full bg-[#38bdf8]" />
            Goal
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[340px] w-full">
        {ringTicks.map((tick) => (
          <circle
            key={`ring-${tick}`}
            cx={centerX}
            cy={centerY}
            r={radiusScale(tick)}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray={tick === 100 ? "0" : "3 3"}
          />
        ))}

        {data.map((item) => {
          const point = getAxisPoint(item.angle, outerRadius);
          const labelPoint = getAxisPoint(item.angle, outerRadius + 20);
          const cos = Math.cos(item.angle - Math.PI / 2);
          const textAnchor = cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
          return (
            <g key={`axis-${item.key}`}>
              <line
                x1={centerX}
                y1={centerY}
                x2={point.x}
                y2={point.y}
                stroke="rgba(255,255,255,0.12)"
              />
              <text
                x={labelPoint.x}
                y={labelPoint.y}
                fill="rgba(228,228,231,0.9)"
                fontSize="10"
                letterSpacing="0.12em"
                textAnchor={textAnchor}
                dominantBaseline="middle"
              >
                {item.label}
              </text>
            </g>
          );
        })}

        <g transform={`translate(${centerX},${centerY})`}>
          <path
            d={targetPath}
            fill="rgba(56,189,248,0.16)"
            stroke="rgba(56,189,248,0.95)"
            strokeWidth={2}
          />
          <path
            d={currentPath}
            fill="rgba(78,222,163,0.18)"
            stroke="rgba(78,222,163,0.95)"
            strokeWidth={2}
          />
        </g>

        {data.map((item) => {
          const currentPoint = getAxisPoint(item.angle, radiusScale(item.current));
          const targetPoint = getAxisPoint(item.angle, radiusScale(item.target));
          return (
            <g key={`point-${item.key}`}>
              <circle cx={targetPoint.x} cy={targetPoint.y} r={3} fill="#38bdf8" />
              <circle cx={currentPoint.x} cy={currentPoint.y} r={3.4} fill="#4edea3" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export type AbilityTrendPoint = AbilityProfileData & {
  label: string;
};

type AbilityTrendMultiLineChartProps = {
  data: AbilityTrendPoint[];
};

export function AbilityTrendMultiLineChart({ data }: AbilityTrendMultiLineChartProps) {
  const width = 920;
  const height = 320;
  const margin = { top: 24, right: 20, bottom: 44, left: 44 };

  const xScale = scalePoint<string>()
    .domain(data.map((item) => item.label))
    .range([margin.left, width - margin.right])
    .padding(0.5);
  const yScale = scaleLinear().domain([0, 100]).range([height - margin.bottom, margin.top]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-2.5">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full">
        {[0, 20, 40, 60, 80, 100].map((tick) => (
          <g key={`y-${tick}`}>
            <line
              x1={margin.left}
              y1={yScale(tick)}
              x2={width - margin.right}
              y2={yScale(tick)}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 4"
            />
            <text
              x={margin.left - 8}
              y={yScale(tick)}
              fill="rgba(161,161,170,0.9)"
              fontSize="10"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {tick}
            </text>
          </g>
        ))}

        {ABILITY_METRIC_ORDER.map((metricKey) => {
          const lineGenerator = d3Line<AbilityTrendPoint>()
            .x((item) => xScale(item.label) ?? margin.left)
            .y((item) => yScale(item[metricKey]))
            .curve(curveMonotoneX);
          const path = lineGenerator(data) ?? "";
          const color = ABILITY_METRIC_COLORS[metricKey];
          return (
            <g key={`line-${metricKey}`}>
              <path d={path} fill="none" stroke={color} strokeWidth={2.2} />
              {data.map((item) => (
                <circle
                  key={`${metricKey}-${item.label}`}
                  cx={xScale(item.label) ?? margin.left}
                  cy={yScale(item[metricKey])}
                  r={2.2}
                  fill={color}
                />
              ))}
            </g>
          );
        })}

        {data.map((item) => (
          <text
            key={`x-${item.label}`}
            x={xScale(item.label) ?? margin.left}
            y={height - 16}
            fill="rgba(161,161,170,0.9)"
            fontSize="10"
            textAnchor="middle"
          >
            {item.label}
          </text>
        ))}
      </svg>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.14em] text-zinc-300 sm:grid-cols-3 lg:grid-cols-6">
        {ABILITY_METRIC_ORDER.map((key) => (
          <div key={`legend-${key}`} className="inline-flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: ABILITY_METRIC_COLORS[key] }}
            />
            {ABILITY_METRIC_LABELS[key]}
          </div>
        ))}
      </div>
    </div>
  );
}

type TrainingCalendarHeatmapProps = {
  sessions: TrainingHistoryItem[];
  trailingDays?: number;
};

type HeatCell = {
  date: Date;
  key: string;
  inRange: boolean;
  sessions: number;
  loadMinutes: number;
  weekIndex: number;
  weekdayIndex: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toLocalDayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfLocalDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

export function TrainingCalendarHeatmap({
  sessions,
  trailingDays = 84
}: TrainingCalendarHeatmapProps) {
  const cells = useMemo<HeatCell[]>(() => {
    const aggregate = new Map<string, { sessions: number; loadMinutes: number }>();
    for (const item of sessions) {
      const start = new Date(item.startTime);
      const end = new Date(item.endTime);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      if (end.getTime() <= start.getTime()) continue;
      const loadMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
      const key = toLocalDayKey(start);
      const current = aggregate.get(key) ?? { sessions: 0, loadMinutes: 0 };
      current.sessions += 1;
      current.loadMinutes += loadMinutes;
      aggregate.set(key, current);
    }

    const endDate = startOfLocalDay(new Date());
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - trailingDays + 1);

    const gridStart = new Date(startDate);
    gridStart.setDate(startDate.getDate() - startDate.getDay());
    const gridEnd = new Date(endDate);
    gridEnd.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const totalDays = Math.floor((gridEnd.getTime() - gridStart.getTime()) / DAY_MS) + 1;
    const result: HeatCell[] = [];
    for (let i = 0; i < totalDays; i += 1) {
      const date = new Date(gridStart.getTime() + i * DAY_MS);
      const dayKey = toLocalDayKey(date);
      const inRange = date >= startDate && date <= endDate;
      const stat = aggregate.get(dayKey);
      result.push({
        date,
        key: dayKey,
        inRange,
        sessions: inRange ? stat?.sessions ?? 0 : 0,
        loadMinutes: inRange ? stat?.loadMinutes ?? 0 : 0,
        weekIndex: Math.floor(i / 7),
        weekdayIndex: date.getDay()
      });
    }
    return result;
  }, [sessions, trailingDays]);

  const maxLoad = Math.max(...cells.map((cell) => cell.loadMinutes), 1);
  const colorScale = scaleLinear<string>().domain([0, maxLoad]).range(["#111827", "#4edea3"]);

  const cellSize = 14;
  const cellGap = 4;
  const weeks = Math.max(...cells.map((cell) => cell.weekIndex), 0) + 1;
  const width = weeks * (cellSize + cellGap) + 50;
  const height = 7 * (cellSize + cellGap) + 24;

  const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="h-full rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
          Training Consistency Heatmap
        </h3>
        <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          Last {trailingDays} days
        </p>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        {weekdayLabels.map((label, index) => (
          <text
            key={`weekday-${label}-${index}`}
            x={2}
            y={index * (cellSize + cellGap) + cellSize}
            fill="rgba(161,161,170,0.85)"
            fontSize="9"
            textAnchor="start"
          >
            {label}
          </text>
        ))}
        {cells.map((cell) => {
          const x = 20 + cell.weekIndex * (cellSize + cellGap);
          const y = cell.weekdayIndex * (cellSize + cellGap);
          const fill = !cell.inRange
            ? "rgba(255,255,255,0.02)"
            : cell.loadMinutes > 0
            ? colorScale(cell.loadMinutes)
            : "rgba(255,255,255,0.06)";
          return (
            <rect
              key={cell.key}
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              rx={2}
              fill={fill}
              stroke="rgba(255,255,255,0.06)"
            >
              <title>{`${cell.key} | sessions: ${cell.sessions} | load: ${cell.loadMinutes} min`}</title>
            </rect>
          );
        })}
      </svg>

      <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-zinc-400">
        <span>Low load</span>
        <div className="flex items-center gap-1">
          {[0, 0.33, 0.66, 1].map((value) => (
            <span
              key={`legend-${value}`}
              className="h-2 w-6 rounded-sm"
              style={{ backgroundColor: colorScale(maxLoad * value) }}
            />
          ))}
        </div>
        <span>High load</span>
      </div>
    </div>
  );
}

function OrbCore({ score }: { score: number }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);

  const glowColor = score >= 80 ? "#4edea3" : score >= 65 ? "#38bdf8" : "#f59e0b";

  useFrame((_, delta) => {
    if (coreRef.current) {
      coreRef.current.rotation.x += delta * 0.2;
      coreRef.current.rotation.y += delta * 0.28;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.36;
    }
    if (shellRef.current) {
      shellRef.current.rotation.y -= delta * 0.1;
    }
  });

  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[2.4, 1.8, 2.5]} intensity={1.2} color={glowColor} />
      <pointLight position={[-2.2, -1.6, -2]} intensity={0.6} color="#94a3b8" />

      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1, 6]} />
        <meshStandardMaterial
          color={glowColor}
          metalness={0.45}
          roughness={0.2}
          emissive={glowColor}
          emissiveIntensity={0.24}
          wireframe
        />
      </mesh>

      <mesh ref={shellRef}>
        <sphereGeometry args={[1.35, 42, 42]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.12} />
      </mesh>

      <mesh ref={ringRef} rotation={[Math.PI / 2.2, 0, 0]}>
        <torusGeometry args={[1.95, 0.03, 18, 160]} />
        <meshStandardMaterial color="#d4d4d8" emissive={glowColor} emissiveIntensity={0.22} />
      </mesh>
    </>
  );
}

type ReadinessOrbPanelProps = {
  score: number;
  status: string;
  deltaToGoal: number;
};

export function ReadinessOrbPanel({ score, status, deltaToGoal }: ReadinessOrbPanelProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
        3D Readiness Core
      </h3>
      <div className="mt-2 h-44 overflow-hidden rounded-xl border border-white/10 bg-black/40">
        <Canvas camera={{ position: [0, 0, 4.8], fov: 45 }} dpr={[1, 1.8]}>
          <OrbCore score={score} />
        </Canvas>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Readiness</p>
          <p className="mt-1 text-xl font-semibold text-white">{score}/100</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Status</p>
          <p className="mt-1 text-xl font-semibold text-[#4edea3]">{status}</p>
        </div>
      </div>
      <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-zinc-400">
        Delta to Goal:{" "}
        <span className={deltaToGoal >= 0 ? "text-rose-300" : "text-[#4edea3]"}>
          {deltaToGoal >= 0 ? `+${deltaToGoal}` : `${deltaToGoal}`}
        </span>
      </p>
    </div>
  );
}
