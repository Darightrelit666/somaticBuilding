import React, { Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import {
  CheckCircle2,
  Flame,
  Timer,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float } from "@react-three/drei";
import * as THREE from "three";
import { getWorkoutSession, type WorkoutSession } from "../../shared/api/workout";
import {
  fetchTrainingRunSummary,
  type TrainingRunSummary
} from "../../shared/api/training";

type ProgramDaySlot = {
  dayKey: string;
  moduleId: number | null;
  courseId: number | null;
  focus: string;
};

type WeeklyProgram = {
  id: string;
  weekStart: string;
  slots: ProgramDaySlot[];
  updatedAt: string;
};

const PROGRAM_STORAGE_KEY = "trainingHubWeeklyPrograms";
const DAY_COMPLETION_STORAGE_KEY = "trainingHubProgramDayCompletion";
const PENDING_AUTO_CHECKIN_KEY = "trainingHubPendingAutoCheckin";
const SUMMARY_SNAPSHOT_STORAGE_KEY = "workoutLastSummarySnapshot";

const toLocalDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseDateOnly = (raw: string) => {
  const safe = String(raw ?? "").trim();
  if (!safe) return null;
  const parsed = new Date(`${safe}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const isDateInProgramWeek = (date: Date, weekStart: string) => {
  const start = parseDateOnly(weekStart);
  if (!start) return false;
  const end = addDays(start, 6);
  const target = parseDateOnly(toLocalDateKey(date));
  if (!target) return false;
  return target >= start && target <= end;
};

const readPrograms = (): WeeklyProgram[] => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(PROGRAM_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as WeeklyProgram[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readStringRecord = (key: string) => {
  if (typeof window === "undefined") return {} as Record<string, string>;
  const raw = window.localStorage.getItem(key);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const entries = Object.entries(parsed).filter((entry): entry is [string, string] => {
      return typeof entry[0] === "string" && typeof entry[1] === "string";
    });
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
};

const writeStringRecord = (key: string, map: Record<string, string>) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(map));
};

const selectActiveProgram = (programs: WeeklyProgram[], date: Date) => {
  const inRange = programs.filter((program) => isDateInProgramWeek(date, program.weekStart));
  const sortByUpdated = (a: WeeklyProgram, b: WeeklyProgram) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  if (inRange.length > 0) return [...inRange].sort(sortByUpdated)[0];
  if (programs.length === 0) return null;
  return [...programs].sort(sortByUpdated)[0];
};

const getDayKeyFromDate = (date: Date) => {
  const map: Record<number, string> = {
    0: "sun",
    1: "mon",
    2: "tue",
    3: "wed",
    4: "thu",
    5: "fri",
    6: "sat"
  };
  return map[date.getDay()] ?? "mon";
};

function StatueModel() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const targetX = (state.pointer.x * Math.PI) / 8;
    const targetY = (state.pointer.y * Math.PI) / 8;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetX,
      0.05
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      -targetY,
      0.05
    );
  });

  return (
    <group ref={groupRef}>
      <mesh scale={1.5}>
        <torusKnotGeometry args={[1, 0.3, 256, 32]} />
        <meshStandardMaterial
          color="#111111"
          roughness={0.1}
          metalness={0.9}
          envMapIntensity={0.5}
        />
      </mesh>
    </group>
  );
}

function SomaticCanvas() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 opacity-40 mix-blend-screen">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.2} />
        <spotLight
          position={[5, -5, 2]}
          angle={0.5}
          penumbra={1}
          intensity={50}
          color="#8B5CF6"
        />
        <spotLight
          position={[-5, 5, 5]}
          angle={0.5}
          penumbra={1}
          intensity={40}
          color="#3B82F6"
        />
        <pointLight position={[0, 0, -5]} intensity={20} color="#ffffff" />
        <Environment preset="city" />
        <Suspense fallback={null}>
          <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
            <StatueModel />
          </Float>
        </Suspense>
      </Canvas>
    </div>
  );
}

type WorkoutSummarySnapshot = {
  completedAt?: string;
  sessionName?: string;
  trainingStyle?: string;
  totalBlocks?: number;
  totalExercises?: number;
  plannedSetCount?: number;
  completedSetCount?: number;
  skippedExerciseCount?: number;
  elapsedSeconds?: number;
  elapsedMinutes?: number;
  runId?: number;
  sessionId?: number;
};

type WorkoutSummaryViewModel = {
  title: string;
  subtitle: string;
  totalMinutes: number;
  plannedSets: number;
  completedSets: number;
  totalExercises: number;
  totalBlocks: number;
  completionRate: number;
  xpGained: number;
  motto: string;
  note: string;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const readSafeCount = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
};

const readPositiveNumber = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
};

const getSessionPlanStats = (session: WorkoutSession) => {
  const blocks = Array.isArray(session.blocks) ? session.blocks : [];
  const totalBlocks = blocks.length;
  let totalExercises = 0;
  let plannedSets = 0;

  blocks.forEach((block) => {
    (block.groups ?? []).forEach((group) => {
      (group.exercises ?? []).forEach((exercise) => {
        totalExercises += 1;
        plannedSets += Math.max(1, Number(exercise.sets ?? 1));
      });
    });
  });

  return { totalBlocks, totalExercises, plannedSets };
};

const buildSummaryFromSnapshot = (snapshot: WorkoutSummarySnapshot): WorkoutSummaryViewModel => {
  const plannedSets = Math.max(0, Number(snapshot.plannedSetCount ?? 0));
  const completedSetsRaw = Math.max(0, Number(snapshot.completedSetCount ?? 0));
  const completedSets = plannedSets > 0 ? Math.min(plannedSets, completedSetsRaw) : completedSetsRaw;
  const totalExercises = Math.max(0, Number(snapshot.totalExercises ?? 0));
  const totalBlocks = Math.max(0, Number(snapshot.totalBlocks ?? 0));
  const totalMinutes = Math.max(
    1,
    Number(snapshot.elapsedMinutes ?? 0) > 0
      ? Math.round(Number(snapshot.elapsedMinutes ?? 0))
      : Math.round(Math.max(1, Number(snapshot.elapsedSeconds ?? 60)) / 60)
  );
  const completionRate =
    plannedSets > 0 ? clampPercent((completedSets / plannedSets) * 100) : completedSets > 0 ? 100 : 0;
  const xpBase = completedSets * 6 + totalExercises * 2 + completionRate;
  const xpGained = Math.max(20, Math.round(xpBase));

  return {
    title: String(snapshot.sessionName ?? "").trim() || "Training Session",
    subtitle:
      `${String(snapshot.trainingStyle ?? "").trim() || "Strength & Conditioning"} · ` +
      `${Math.max(1, totalBlocks)} blocks · ${Math.max(1, totalExercises)} exercises`,
    totalMinutes,
    plannedSets,
    completedSets,
    totalExercises,
    totalBlocks,
    completionRate,
    xpGained,
    motto: "You completed the intended session structure.",
    note:
      completionRate >= 90
        ? "Execution quality stayed high through the full session."
        : "Keep consistency, and tighten execution on remaining sets next session."
  };
};

const buildSummaryFromSession = (session: WorkoutSession): WorkoutSummaryViewModel => {
  const blocks = Array.isArray(session.blocks) ? session.blocks : [];
  const totalBlocks = blocks.length;
  let totalExercises = 0;
  let plannedSets = 0;

  blocks.forEach((block) => {
    (block.groups ?? []).forEach((group) => {
      (group.exercises ?? []).forEach((exercise) => {
        totalExercises += 1;
        plannedSets += Math.max(1, Number(exercise.sets ?? 1));
      });
    });
  });

  const estimatedMinutes = Math.max(
    8,
    Math.round((plannedSets * 45 + totalExercises * 20 + totalBlocks * 30) / 60)
  );
  const completionRate = plannedSets > 0 ? 100 : 0;
  const xpGained = Math.max(20, Math.round(plannedSets * 6 + totalExercises * 2 + totalBlocks * 3));

  return {
    title: session.sessionName?.trim() || "Training Session",
    subtitle:
      `${session.trainingStyle?.trim() || "Strength & Conditioning"} · ` +
      `${Math.max(1, totalBlocks)} blocks · ${Math.max(1, totalExercises)} exercises`,
    totalMinutes: estimatedMinutes,
    plannedSets,
    completedSets: plannedSets,
    totalExercises,
    totalBlocks,
    completionRate,
    xpGained,
    motto: "Session data synced from current workout plan.",
    note: "Summary is mapped from your active session structure."
  };
};

const buildSummaryFromRun = (
  runSummary: TrainingRunSummary,
  snapshot: WorkoutSummarySnapshot | null,
  session: WorkoutSession | null
): WorkoutSummaryViewModel => {
  const sessionPlan = session ? getSessionPlanStats(session) : null;
  const plannedSetsFromSnapshot = readSafeCount(Number(snapshot?.plannedSetCount ?? 0));
  const plannedSets =
    plannedSetsFromSnapshot > 0
      ? plannedSetsFromSnapshot
      : readSafeCount(Number(sessionPlan?.plannedSets ?? 0));

  const completedSets = readSafeCount(runSummary.setLogCount);
  const blocksFromSnapshot = readSafeCount(Number(snapshot?.totalBlocks ?? 0));
  const exercisesFromSnapshot = readSafeCount(Number(snapshot?.totalExercises ?? 0));
  const totalBlocks =
    blocksFromSnapshot > 0 ? blocksFromSnapshot : readSafeCount(Number(sessionPlan?.totalBlocks ?? 0));
  const totalExercises =
    runSummary.distinctExerciseCount > 0
      ? readSafeCount(runSummary.distinctExerciseCount)
      : exercisesFromSnapshot > 0
      ? exercisesFromSnapshot
      : readSafeCount(Number(sessionPlan?.totalExercises ?? 0));

  const snapshotSeconds = readSafeCount(Number(snapshot?.elapsedSeconds ?? 0));
  const snapshotMinutes = readSafeCount(Number(snapshot?.elapsedMinutes ?? 0));
  const runDurationSeconds = readSafeCount(runSummary.durationSeconds);
  const totalMinutes = Math.max(
    1,
    Math.round(
      (runDurationSeconds > 0
        ? runDurationSeconds
        : snapshotSeconds > 0
        ? snapshotSeconds
        : snapshotMinutes > 0
        ? snapshotMinutes * 60
        : 60) / 60
    )
  );

  const completionRate =
    plannedSets > 0 ? clampPercent((completedSets / plannedSets) * 100) : completedSets > 0 ? 100 : 0;
  const xpBase = completedSets * 6 + totalExercises * 2 + completionRate;
  const xpGained = Math.max(20, Math.round(xpBase));
  const skippedExerciseCount = readSafeCount(runSummary.skippedExerciseCount);
  const title =
    String(snapshot?.sessionName ?? "").trim() ||
    String(session?.sessionName ?? "").trim() ||
    "Training Session";
  const trainingStyle =
    String(snapshot?.trainingStyle ?? "").trim() ||
    String(session?.trainingStyle ?? "").trim() ||
    "Strength & Conditioning";

  const noteParts = [
    `Real logs: ${completedSets} sets`,
    `${readSafeCount(runSummary.totalReps)} reps`
  ];
  if (skippedExerciseCount > 0) {
    noteParts.push(`${skippedExerciseCount} skipped`);
  }

  return {
    title,
    subtitle: `${trainingStyle} | ${Math.max(1, totalBlocks)} blocks | ${Math.max(1, totalExercises)} exercises`,
    totalMinutes,
    plannedSets,
    completedSets,
    totalExercises,
    totalBlocks,
    completionRate,
    xpGained,
    motto: "Summary synced from real execution logs.",
    note: `${noteParts.join(" | ")}.`
  };
};

const createFallbackSummary = (): WorkoutSummaryViewModel => ({
  title: "Training Session",
  subtitle: "Strength & Conditioning · 1 block · 1 exercise",
  totalMinutes: 20,
  plannedSets: 3,
  completedSets: 3,
  totalExercises: 1,
  totalBlocks: 1,
  completionRate: 100,
  xpGained: 30,
  motto: "You showed up. That is the first victory.",
  note: "Consistency is the architecture of strength."
});

export function WorkoutSummaryPage() {
  const [summary, setSummary] = useState<WorkoutSummaryViewModel>(() => createFallbackSummary());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(PENDING_AUTO_CHECKIN_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { completedAt?: string };
      const completedAt =
        typeof parsed?.completedAt === "string" && parsed.completedAt.trim()
          ? new Date(parsed.completedAt)
          : new Date();
      if (Number.isNaN(completedAt.getTime())) {
        throw new Error("Invalid completion time.");
      }

      const programs = readPrograms();
      const activeProgram = selectActiveProgram(programs, completedAt);
      if (!activeProgram) return;

      const dayKey = getDayKeyFromDate(completedAt);
      const slot = activeProgram.slots.find((item) => item.dayKey === dayKey);
      const hasAssignment = Boolean(
        slot && (slot.moduleId || slot.courseId || slot.focus.trim())
      );
      if (!hasAssignment) return;

      const completionKey = `${activeProgram.id}:${activeProgram.weekStart}:${dayKey}`;
      const completionMap = readStringRecord(DAY_COMPLETION_STORAGE_KEY);
      completionMap[completionKey] = `done:${completedAt.toISOString()}`;
      writeStringRecord(DAY_COMPLETION_STORAGE_KEY, completionMap);
    } catch {
      // ignore malformed pending payload
    } finally {
      window.localStorage.removeItem(PENDING_AUTO_CHECKIN_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const loadSummary = async () => {
      const snapshotRaw = window.localStorage.getItem(SUMMARY_SNAPSHOT_STORAGE_KEY);
      let snapshot: WorkoutSummarySnapshot | null = null;
      if (snapshotRaw) {
        try {
          snapshot = JSON.parse(snapshotRaw) as WorkoutSummarySnapshot;
        } catch {
          snapshot = null;
        }
      }

      const runId = readPositiveNumber(
        snapshot?.runId ?? window.localStorage.getItem("workoutActiveRunId")
      );
      const sessionId = readPositiveNumber(
        snapshot?.sessionId ?? window.localStorage.getItem("workoutActiveSessionId")
      );
      const shouldLoadSessionContext =
        !snapshot ||
        readSafeCount(Number(snapshot.plannedSetCount ?? 0)) <= 0 ||
        readSafeCount(Number(snapshot.totalBlocks ?? 0)) <= 0 ||
        readSafeCount(Number(snapshot.totalExercises ?? 0)) <= 0 ||
        !String(snapshot.sessionName ?? "").trim() ||
        !String(snapshot.trainingStyle ?? "").trim();

      let session: WorkoutSession | null = null;
      if (sessionId > 0 && shouldLoadSessionContext) {
        try {
          session = await getWorkoutSession(sessionId);
        } catch {
          session = null;
        }
      }

      if (runId > 0) {
        try {
          const runSummary = await fetchTrainingRunSummary(runId);
          if (!cancelled) {
            setSummary(buildSummaryFromRun(runSummary, snapshot, session));
          }
          return;
        } catch {
          // Continue fallback below.
        }
      }

      if (snapshot) {
        if (!cancelled) {
          setSummary(buildSummaryFromSnapshot(snapshot));
        }
        return;
      }

      if (session) {
        if (!cancelled) {
          setSummary(buildSummaryFromSession(session));
        }
        return;
      }

      if (sessionId > 0) {
        try {
          const sessionFromApi = await getWorkoutSession(sessionId);
          if (!cancelled) {
            setSummary(buildSummaryFromSession(sessionFromApi));
          }
          return;
        } catch {
          // Fall through to fallback summary.
        }
      }

      if (!cancelled) {
        setSummary(createFallbackSummary());
      }
    };

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  const summaryStats = [
    { label: "Total Time", value: `${summary.totalMinutes} min`, icon: Timer },
    {
      label: "Sets Completed",
      value:
        summary.plannedSets > 0
          ? `${summary.completedSets} / ${summary.plannedSets}`
          : String(summary.completedSets),
      icon: CheckCircle2
    },
    {
      label: "Exercise Count",
      value: `${summary.totalExercises} in ${summary.totalBlocks} blocks`,
      icon: TrendingUp
    },
    { label: "XP Gained", value: `+${summary.xpGained}`, icon: Flame }
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0b0b] text-zinc-100">
      <SomaticCanvas />
      <div className="absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-purple-500/10 blur-[160px]" />
      <div className="absolute -bottom-40 right-0 h-[480px] w-[480px] rounded-full bg-blue-500/10 blur-[180px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <p className="text-xs uppercase tracking-[0.4em] text-[#c9b37d]">
            Session Complete
          </p>
          <h1 className="mt-4 font-serif text-4xl font-semibold text-white sm:text-6xl">
            {summary.title}
          </h1>
          <p className="mt-4 text-sm tracking-[0.2em] text-zinc-400">
            {summary.subtitle}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="mt-12 grid gap-4 sm:grid-cols-2"
        >
          {summaryStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-5 backdrop-blur"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-[#c9b37d]">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {stat.value}
                  </p>
                </div>
              </div>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-14 rounded-3xl border border-white/10 bg-white/[0.02] p-10 text-center shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#c9b37d]/40 bg-[#c9b37d]/10 text-[#c9b37d]">
            <Trophy className="h-7 w-7" />
          </div>
          <p className="mt-6 font-serif text-2xl text-white">
            {summary.motto}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            {summary.note}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
            Completion Rate {summary.completionRate}%
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/training"
              className="inline-flex items-center justify-center rounded-full bg-[#c9b37d] px-8 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#0b0b0b] transition hover:bg-[#dcc78f]"
            >
              Continue Training
            </Link>
            <Link
              to="/athlete"
              className="inline-flex items-center justify-center rounded-full border border-white/10 px-8 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/30 hover:bg-white/5"
            >
              View Profile
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
