import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "../../shared/components/ui/button";
import { CheckCircle2, Pause, SkipForward } from "lucide-react";
import { exercises as fallbackExercises } from "../../shared/data/exercises";
import { fetchExerciseList } from "../../shared/api/exercises";
import { getWorkoutSession } from "../../shared/api/workout";
import {
  createExerciseLog,
  createSetLog,
  startTrainingRun,
  updateTrainingRunStatus
} from "../../shared/api/training";

type WorkoutState = "work" | "rest" | "transition";
type WorkoutType = "Strength" | "HIIT";
type TimerMode = "countup" | "countdown" | "hiit";

type PlayerExercise = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  rest: number;
};

type PlayerBlock = {
  name: string;
  items: PlayerExercise[];
};

type WorkoutBuilderDraft = {
  sessionName: string;
  trainingStyle: string;
  blocks: {
    title: string;
    groups?: { items: { id: string; name: string; sets: number; reps: number; rest: number }[] }[];
    items?: { id: string; name: string; sets: number; reps: number; rest: number }[];
  }[];
};

type QuickModulePayload = {
  id?: string;
  title?: string;
  duration?: string;
  structure?: string;
  workSeconds?: number;
  restSeconds?: number;
  exercises?: { name: string; reps: string }[];
};

type CatalogExercise = {
  id: string;
  name: string;
  imageUrl?: string;
};

const styleBlocksMap: Record<string, string[]> = {
  "Strength & Conditioning": [
    "Warmup",
    "Activation",
    "Power",
    "Strength",
    "Accessory",
    "Conditioning",
    "Cooldown"
  ],
  Bodybuilding: ["Warmup", "Compound", "Secondary", "Isolation", "Pump", "Cooldown"],
  CrossFit: ["Warmup", "Skill", "Strength", "WOD", "Cooldown"],
  Functional: ["Warmup", "Movement Prep", "Strength", "Circuit", "Finisher", "Cooldown"],
  "Mobility / Yoga": ["Breathing", "Mobility", "Flow", "Stretch", "Relax"],
  Athletic: ["Warmup", "Speed", "Agility", "Power", "Strength", "Conditioning", "Cooldown"],
  Rehab: ["Assessment", "Activation", "Corrective", "Strength", "Mobility"]
};

const timerModeByStyle: Record<string, TimerMode> = {
  "Strength & Conditioning": "countup",
  Bodybuilding: "countup",
  Functional: "countup",
  Athletic: "countup",
  "Mobility / Yoga": "countdown",
  Rehab: "countdown",
  CrossFit: "hiit",
  Tabata: "hiit",
  HIIT: "hiit"
};

const fallbackBlocks: PlayerBlock[] = [
  {
    name: "Warmup",
    items: [
      { id: "1", name: "Barbell Back Squat", sets: 2, reps: 8, rest: 45 },
      { id: "5", name: "Standard Push-Up", sets: 2, reps: 12, rest: 45 }
    ]
  },
  {
    name: "Strength",
    items: [
      { id: "3", name: "Flat Bench Press", sets: 5, reps: 5, rest: 90 },
      { id: "4", name: "Strict Pull-Up", sets: 4, reps: 8, rest: 75 }
    ]
  }
];

const buildBlocksFromDraft = (draft: WorkoutBuilderDraft | null): PlayerBlock[] => {
  if (!draft?.blocks?.length) return [];
  return draft.blocks.map((block) => {
    const itemsFromGroups =
      block.groups?.flatMap((group) => group.items || []) || [];
    const items = [...itemsFromGroups, ...(block.items || [])].map((item) => ({
      id: item.id,
      name: item.name,
      sets: item.sets || 3,
      reps: item.reps || 8,
      rest: item.rest || 60
    }));
    return { name: block.title, items };
  });
};

const formatTime = (value: number) => {
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const DEMO_USER_ID = 1;
const SUMMARY_SNAPSHOT_STORAGE_KEY = "workoutLastSummarySnapshot";

const resolveUserId = () => {
  if (typeof window === "undefined") return DEMO_USER_ID;
  const raw =
    window.localStorage.getItem("workoutActiveUserId") ||
    window.localStorage.getItem("userId");
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEMO_USER_ID;
};

const parseSessionIdFromSearch = (search: string) => {
  const value = new URLSearchParams(search).get("sessionId");
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export function WorkoutPlayerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<WorkoutState>("work");
  const [trainingStyle, setTrainingStyle] = useState("Strength & Conditioning");
  const [workoutType, setWorkoutType] = useState<WorkoutType>("Strength");
  const [sessionName, setSessionName] = useState("Training Session");
  const [catalogExercises, setCatalogExercises] = useState<CatalogExercise[]>(fallbackExercises);
  const [blocks, setBlocks] = useState<PlayerBlock[]>(fallbackBlocks);
  const [blockIndex, setBlockIndex] = useState(0);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [restRemaining, setRestRemaining] = useState(60);
  const [workRemaining, setWorkRemaining] = useState(30);
  const [workElapsed, setWorkElapsed] = useState(0);
  const [hiitWorkSeconds, setHiitWorkSeconds] = useState(40);
  const [hiitRestSeconds, setHiitRestSeconds] = useState(20);
  const [workActive, setWorkActive] = useState(false);
  const [transitionBlockName, setTransitionBlockName] = useState("");
  const [restReady, setRestReady] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [completedSetCount, setCompletedSetCount] = useState(0);
  const [skippedExerciseCount, setSkippedExerciseCount] = useState(0);
  const sessionStartedAtRef = useRef<number>(Date.now());
  const transitionTimeout = useRef<number | null>(null);
  const strengthWorkTickOnceRef = useRef(false);

  const exerciseMap = useMemo(() => {
    return new Map(catalogExercises.map((exercise) => [exercise.id, exercise]));
  }, [catalogExercises]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const init = async () => {
      setSyncError(null);
      setCompletedSetCount(0);
      setSkippedExerciseCount(0);
      sessionStartedAtRef.current = Date.now();

      const mergedCatalog = new Map<string, CatalogExercise>();
      fallbackExercises.forEach((item) => mergedCatalog.set(item.id, item));
      const storedCatalog = window.localStorage.getItem("workoutCatalog");
      if (storedCatalog) {
        try {
          const parsed = JSON.parse(storedCatalog) as CatalogExercise[];
          if (Array.isArray(parsed)) {
            parsed.forEach((item) => {
              if (!item?.id || !item?.name) return;
              mergedCatalog.set(String(item.id), { ...item, id: String(item.id) });
            });
          }
        } catch {
          // ignore malformed storage
        }
      }
      try {
        const remoteCatalog = await fetchExerciseList({ page: 1, pageSize: 2000 });
        if (!cancelled) {
          remoteCatalog.list.forEach((item) => {
            const id = String(item.id);
            if (!id) return;
            const existing = mergedCatalog.get(id);
            mergedCatalog.set(id, {
              id,
              name: item.name?.trim() || existing?.name || `Exercise #${id}`,
              imageUrl: item.imageUrl || existing?.imageUrl
            });
          });
        }
      } catch {
        // keep local fallback catalog when backend catalog fetch fails
      }
      const catalog = [...mergedCatalog.values()];
      if (!cancelled) {
        setCatalogExercises(catalog);
        window.localStorage.setItem("workoutCatalog", JSON.stringify(catalog));
      }

      const quickModule = window.localStorage.getItem("quickModuleActive");
      if (quickModule) {
        try {
          const parsed = JSON.parse(quickModule) as QuickModulePayload;
          if (parsed?.title && parsed?.exercises?.length) {
            setSessionName(parsed.title);
            setTrainingStyle(parsed.structure ?? "Quick Module");
            setWorkoutType("HIIT");
            setHiitWorkSeconds(parsed.workSeconds ?? 40);
            setHiitRestSeconds(parsed.restSeconds ?? 20);
            const quickBlock: PlayerBlock = {
              name: "Quick Module",
              items: parsed.exercises.map((exercise, index) => ({
                id: String(index + 1),
                name: exercise.name,
                sets: 1,
                reps:
                  Number.parseInt(exercise.reps.replace(/\D/g, ""), 10) ||
                  (parsed.workSeconds ?? 40),
                rest: parsed.restSeconds ?? 20
              }))
            };
            setBlocks([quickBlock]);
            setBlockIndex(0);
            setExerciseIndex(0);
            setSetIndex(0);
            setActiveSessionId(null);
            setActiveRunId(null);
            return;
          }
        } catch {
          // ignore malformed storage
        }
      }

      const querySessionId = parseSessionIdFromSearch(location.search);
      const storedSessionIdRaw = window.localStorage.getItem("workoutActiveSessionId");
      const storedSessionId = storedSessionIdRaw ? Number(storedSessionIdRaw) : NaN;
      const effectiveSessionId =
        querySessionId ??
        (Number.isFinite(storedSessionId) && storedSessionId > 0 ? storedSessionId : null);

      if (effectiveSessionId) {
        try {
          const remoteSession = await getWorkoutSession(effectiveSessionId);
          if (cancelled) return;

          const remoteBlocks: PlayerBlock[] =
            (remoteSession.blocks || [])
              .slice()
              .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
              .map((block) => {
                const items: PlayerExercise[] =
                  (block.groups || [])
                    .slice()
                    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                    .flatMap((group) =>
                      (group.exercises || [])
                        .slice()
                        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                        .map((exercise) => {
                          const id = String(exercise.exerciseId);
                          const catalogItem = mergedCatalog.get(id);
                          return {
                            id,
                            name: catalogItem?.name || `Exercise #${id}`,
                            sets: exercise.sets || 1,
                            reps: exercise.reps || 0,
                            rest: exercise.restSeconds || 0
                          };
                        })
                    );
                return {
                  name: block.blockName || "Block",
                  items
                };
              });

          const hasItems = remoteBlocks.some((block) => block.items.length > 0);
          setSessionName(remoteSession.sessionName || "Training Session");
          setTrainingStyle(remoteSession.trainingStyle || "Strength & Conditioning");
          setWorkoutType(
            (remoteSession.trainingStyle || "").toLowerCase().includes("crossfit")
              ? "HIIT"
              : "Strength"
          );
          setBlocks(hasItems ? remoteBlocks : fallbackBlocks);
          setBlockIndex(0);
          setExerciseIndex(0);
          setSetIndex(0);
          setActiveSessionId(effectiveSessionId);
          window.localStorage.setItem("workoutActiveSessionId", String(effectiveSessionId));

          const storedRunIdRaw = window.localStorage.getItem("workoutActiveRunId");
          const storedRunId = storedRunIdRaw ? Number(storedRunIdRaw) : NaN;
          if (Number.isFinite(storedRunId) && storedRunId > 0) {
            setActiveRunId(storedRunId);
          } else {
            const createdRunId = await startTrainingRun({
              sessionId: effectiveSessionId,
              userId: resolveUserId()
            });
            if (cancelled) return;
            setActiveRunId(createdRunId);
            window.localStorage.setItem("workoutActiveRunId", String(createdRunId));
          }
          return;
        } catch (error) {
          if (!cancelled) {
            const message = error instanceof Error ? error.message : "Failed to load remote session.";
            setSyncError(message);
          }
        }
      }

      const selection = window.localStorage.getItem("workoutStyleSelection");
      let selectedStyle = "Strength & Conditioning";
      if (selection) {
        try {
          const parsed = JSON.parse(selection) as { style?: string };
          if (parsed?.style) {
            selectedStyle = parsed.style;
          }
        } catch {
          // ignore malformed storage
        }
      } else {
        const lastStyle = window.localStorage.getItem("workoutBuilderLastStyle");
        if (lastStyle) {
          selectedStyle = lastStyle;
        }
      }

      setTrainingStyle(selectedStyle);
      setWorkoutType(selectedStyle === "CrossFit" ? "HIIT" : "Strength");

      const draftKey = `workoutBuilderDraft:${selectedStyle}`;
      const storedDraft = window.localStorage.getItem(draftKey);
      let draftBlocks: PlayerBlock[] = [];
      if (storedDraft) {
        try {
          const parsed = JSON.parse(storedDraft) as WorkoutBuilderDraft;
          setSessionName(parsed.sessionName || "Training Session");
          draftBlocks = buildBlocksFromDraft(parsed);
        } catch {
          // ignore malformed storage
        }
      }

      if (!draftBlocks.length) {
        const defaultTitles = styleBlocksMap[selectedStyle] || fallbackBlocks.map((b) => b.name);
        draftBlocks = defaultTitles.map((title) => ({
          name: title,
          items: []
        }));
      }

      const hasItems = draftBlocks.some((block) => block.items.length > 0);
      setBlocks(hasItems ? draftBlocks : fallbackBlocks);
      setBlockIndex(0);
      setExerciseIndex(0);
      setSetIndex(0);
      setActiveSessionId(null);
      setActiveRunId(null);
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [location.search]);

  const currentBlock = blocks[blockIndex] || fallbackBlocks[0];
  const currentExercise = currentBlock?.items[exerciseIndex] || fallbackBlocks[0].items[0];
  const currentImage = exerciseMap.get(currentExercise.id)?.imageUrl;
  const isFinalExercise =
    !currentBlock?.items?.[exerciseIndex + 1] && !blocks?.[blockIndex + 1];
  const nextExercise =
    currentBlock?.items[exerciseIndex + 1]?.name ||
    blocks[blockIndex + 1]?.items[0]?.name ||
    "Finish";

  const timerMode: TimerMode =
    workoutType === "HIIT"
      ? "hiit"
      : timerModeByStyle[trainingStyle] ?? "countup";

  useEffect(() => {
    setWorkElapsed(0);
    strengthWorkTickOnceRef.current = false;
    if (timerMode === "hiit") {
      setWorkRemaining(currentExercise.reps || hiitWorkSeconds);
      setRestRemaining(hiitRestSeconds);
    } else {
      if (timerMode === "countdown") {
        setWorkRemaining(currentExercise.reps || 30);
      }
      setRestRemaining(currentExercise.rest || 60);
    }
    setSetIndex(0);
    setWorkActive(false);
    setRestReady(false);
  }, [currentExercise.id, hiitWorkSeconds, hiitRestSeconds, timerMode]);

  useEffect(() => {
    if (state === "transition") return;
    if (timerMode === "countup") {
      if (state === "work") {
if (!workActive || isPaused) return;
const interval = window.setInterval(() => {
          setWorkElapsed((prev) => {
            const next = prev + 1;
            if (!strengthWorkTickOnceRef.current) {
              strengthWorkTickOnceRef.current = true;
}
            return next;
          });
        }, 1000);
        return () => window.clearInterval(interval);
      }
      if (state !== "rest" || isPaused) return;
      const interval = window.setInterval(() => {
        setRestRemaining((prev) => {
          if (prev <= 1) {
setRestReady(true);
            setState("work");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => window.clearInterval(interval);
    }

    if (timerMode === "countdown") {
      if (state === "work") {
        if (!workActive || isPaused) return;
        const interval = window.setInterval(() => {
          setWorkRemaining((prev) => {
            if (prev <= 1) {
              setState("rest");
              setRestRemaining(currentExercise.rest || 60);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        return () => window.clearInterval(interval);
      }
      if (state !== "rest" || isPaused) return;
      const interval = window.setInterval(() => {
        setRestRemaining((prev) => {
          if (prev <= 1) {
            setRestReady(true);
            setState("work");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => window.clearInterval(interval);
    }

    if (timerMode === "hiit") {
      if (isPaused) return;
      const interval = window.setInterval(() => {
        if (state === "work") {
          setWorkRemaining((prev) => {
            if (prev <= 1) {
              setState("rest");
              setRestRemaining(hiitRestSeconds);
              return 0;
            }
            return prev - 1;
          });
        } else if (state === "rest") {
          setRestRemaining((prev) => {
            if (prev <= 1) {
              advanceExercise();
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
      return () => window.clearInterval(interval);
    }
  }, [
    state,
    isPaused,
    timerMode,
    currentExercise.id,
    currentExercise.rest,
    workActive,
    hiitRestSeconds
  ]);

  const enterTransition = (nextBlockName: string, nextBlockIndex: number) => {
    if (transitionTimeout.current) {
      window.clearTimeout(transitionTimeout.current);
    }
    setTransitionBlockName(nextBlockName);
    setState("transition");
    transitionTimeout.current = window.setTimeout(() => {
      setBlockIndex(nextBlockIndex);
      setExerciseIndex(0);
      setSetIndex(0);
      setState("work");
    }, 900);
  };

  const finishWorkout = () => {
    const totalExercises = blocks.reduce(
      (sum, block) => sum + (Array.isArray(block.items) ? block.items.length : 0),
      0
    );
    const plannedSetCount = blocks.reduce(
      (sum, block) =>
        sum +
        (Array.isArray(block.items)
          ? block.items.reduce((setSum, item) => setSum + Math.max(1, item.sets || 1), 0)
          : 0),
      0
    );
    const elapsedSeconds = Math.max(
      1,
      Math.round((Date.now() - sessionStartedAtRef.current) / 1000)
    );
    const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const snapshot = {
      completedAt: new Date().toISOString(),
      sessionName,
      trainingStyle,
      totalBlocks: blocks.length,
      totalExercises,
      plannedSetCount,
      completedSetCount: Math.max(0, completedSetCount),
      skippedExerciseCount: Math.max(0, skippedExerciseCount),
      elapsedSeconds,
      elapsedMinutes,
      runId: activeRunId ?? 0,
      sessionId: activeSessionId ?? 0
    };
    if (typeof window !== "undefined") {
      const payload = {
        completedAt: snapshot.completedAt,
        source: "workout_player",
        sessionId: snapshot.sessionId,
        runId: snapshot.runId
      };
      window.localStorage.setItem("trainingHubPendingAutoCheckin", JSON.stringify(payload));
      window.localStorage.setItem(SUMMARY_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
    }
    if (activeRunId) {
      updateTrainingRunStatus(activeRunId, { status: 2 })
        .then(() => {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem("workoutActiveRunId");
          }
        })
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : "Failed to finalize training run.";
          setSyncError(message);
        });
    }
    navigate("/workout-summary");
  };

  const advanceExercise = () => {
    if (currentBlock.items[exerciseIndex + 1]) {
      setExerciseIndex((prev) => prev + 1);
      setSetIndex(0);
      setState("work");
      return;
    }
    if (blocks[blockIndex + 1]) {
      enterTransition(blocks[blockIndex + 1].name, blockIndex + 1);
      return;
    }
    finishWorkout();
  };

  const handleCompleteSet = () => {
    if (!currentExercise) return;
    setCompletedSetCount((prev) => prev + 1);
const numericExerciseId = Number(currentExercise.id);
    if (activeRunId && Number.isFinite(numericExerciseId) && numericExerciseId > 0) {
      createSetLog({
        runId: activeRunId,
        exerciseId: numericExerciseId,
        setIndex: setIndex + 1,
        reps: currentExercise.reps,
        durationSeconds: timerMode === "countup" ? workElapsed : undefined
      }).catch((error) => {
        const message = error instanceof Error ? error.message : "Failed to save set log.";
        setSyncError(message);
      });
    }

    if (timerMode === "hiit") return;
    if (setIndex + 1 < currentExercise.sets) {
      setSetIndex((prev) => prev + 1);
      if (timerMode !== "hiit") {
        setState("rest");
        setRestRemaining(currentExercise.rest || 60);
        setIsPaused(false);
        setWorkActive(false);
      }
      return;
    }
    advanceExercise();
  };

  const handleSkip = () => {
    setSkippedExerciseCount((prev) => prev + 1);
    const numericExerciseId = Number(currentExercise.id);
    if (activeRunId && Number.isFinite(numericExerciseId) && numericExerciseId > 0) {
      createExerciseLog({
        runId: activeRunId,
        exerciseId: numericExerciseId,
        note: "skipped"
      }).catch((error) => {
        const message =
          error instanceof Error ? error.message : "Failed to save skipped exercise log.";
        setSyncError(message);
      });
    }

    setState("work");
    setIsPaused(false);
    setWorkActive(false);
    setRestReady(false);
    advanceExercise();
  };

  const timerValue =
    timerMode === "hiit" || timerMode === "countdown"
      ? state === "work"
        ? formatTime(workRemaining)
        : formatTime(restRemaining)
      : state === "work"
      ? formatTime(workElapsed)
      : formatTime(restRemaining);

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.08),_transparent_65%)] blur-3xl" />
          <div className="absolute bottom-[-120px] right-[-120px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,_rgba(45,212,191,0.15),_transparent_70%)] blur-3xl" />
        </div>

        <AnimatePresence mode="wait">
          {state === "transition" && (
            <motion.div
              key="transition"
              className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/90 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.p
                className="text-xs uppercase tracking-[0.45em] text-zinc-400"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                Entering next phase
              </motion.p>
              <motion.h2
                className="mt-4 text-5xl font-semibold tracking-[0.2em] text-white"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                {transitionBlockName.toUpperCase()}
              </motion.h2>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {restReady && (
            <motion.div
              className="absolute inset-0 z-30 flex items-center justify-center bg-black/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950/90 p-6 text-center shadow-2xl"
                initial={{ y: 20, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 10, opacity: 0, scale: 0.98 }}
              >
                <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">
                  Timer Complete
                </p>
                <h3 className="mt-3 text-xl font-semibold text-white">
                  Rest Over
                </h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Time is up. Get ready for the next set.
                </p>
                <Button
                  className="mt-5 w-full bg-white text-black hover:bg-zinc-200"
                  onClick={() => setRestReady(false)}
                >
                  Start Next Set
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8">
          <header className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-zinc-400">
            <div className="space-y-1">
              <p className="text-[11px]">Physical OS</p>
              <p className="text-[11px] text-zinc-500">{sessionName}</p>
            </div>
            <p className="text-[11px] text-zinc-500">
              Block: {currentBlock?.name || trainingStyle}
            </p>
          </header>
          <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            <p>
              Sync: {activeSessionId ? "Backend Session" : "Local Draft"}
            </p>
            <p>{activeRunId ? `Run #${activeRunId}` : "Run not started"}</p>
          </div>
          {syncError && (
            <p className="mt-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
              {syncError}
            </p>
          )}

          <main className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
            <div className="flex w-full flex-col items-center gap-6">
              <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-black/40">
                {currentImage ? (
                  <img
                    src={currentImage}
                    alt={currentExercise.name}
                    className="h-56 w-full object-cover sm:h-72"
                  />
                ) : (
                  <div className="flex h-56 items-center justify-center text-xs uppercase tracking-[0.4em] text-zinc-500">
                    Video / Image
                  </div>
                )}
              </div>

              <motion.h1
                key={currentExercise.name}
                className="text-5xl font-semibold tracking-[0.25em] text-white sm:text-6xl"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {currentExercise.name.toUpperCase()}
              </motion.h1>

            <div className="space-y-2 text-sm uppercase tracking-[0.4em] text-zinc-500">
              {workoutType === "HIIT" ? (
                <>
                  <p>Interval: {currentExercise.reps}s work</p>
                  <p className="text-zinc-400">Rest: {hiitRestSeconds}s</p>
                  <p className="text-zinc-500">Style: {trainingStyle}</p>
                </>
              ) : (
                <>
                  <p>Set {setIndex + 1} / {currentExercise.sets}</p>
                  <p className="text-zinc-400">Target: {currentExercise.reps} reps</p>
                  <p className="text-zinc-500">
                    Rest: {currentExercise.rest}s · Style: {trainingStyle}
                  </p>
                </>
              )}
            </div>
            </div>

            <motion.div
              className={`mt-6 rounded-full border px-12 py-8 text-5xl font-semibold tracking-[0.2em] ${
                state === "work"
                  ? "border-white/30 text-white"
                  : "border-teal-400/60 text-teal-200"
              }`}
              animate={{ scale: state === "rest" ? [1, 1.03, 1] : 1 }}
              transition={{
                duration: 2.4,
                repeat: state === "rest" ? Infinity : 0,
                ease: "easeInOut"
              }}
            >
            {timerMode !== "hiit" && state === "work" && !workActive
              ? "--:--"
              : timerValue}
            </motion.div>
            <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">
              {state === "work" ? "Work" : "Rest"} Timer
            </p>

            <div className="mt-6 flex items-center gap-3">
      {state === "work" && timerMode !== "hiit" && !workActive ? (
        <Button
          className="bg-white text-black hover:bg-zinc-200"
          onClick={() => {
setIsPaused(false);
            setRestReady(false);
            setState("work");
            if (timerMode === "countdown") {
              setWorkRemaining(currentExercise.reps || 30);
            } else {
              setWorkElapsed(0);
            }
            setWorkActive(true);
          }}
        >
          Start Set
        </Button>
              ) : (
                <Button
                  className="bg-white text-black hover:bg-zinc-200"
                  onClick={handleCompleteSet}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Complete Set
                </Button>
              )}
              <Button
                variant="outline"
                className="border-white/20 text-zinc-300 hover:text-white"
                onClick={handleSkip}
              >
                <SkipForward className="mr-2 h-4 w-4" />
                {isFinalExercise ? "View Summary" : "Skip"}
              </Button>
              <Button
                variant="ghost"
                className="text-zinc-400 hover:text-white"
                onClick={() => setIsPaused((prev) => !prev)}
              >
                <Pause className="h-4 w-4" />
              </Button>
            </div>
          </main>

          <footer className="flex items-center justify-center pb-6 text-sm uppercase tracking-[0.35em] text-zinc-500">
            Next: <span className="ml-2 text-zinc-300">{nextExercise}</span>
          </footer>
        </div>
      </div>
    </div>
  );
}


