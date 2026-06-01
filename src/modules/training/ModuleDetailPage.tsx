import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { motion } from "motion/react";
import { Activity, ArrowLeft, Clock, Play } from "lucide-react";
import { fetchExerciseList } from "../../shared/api/exercises";
import { exercises as exerciseCatalog } from "../../shared/data/exercises";
import {
  fetchWorkoutTemplateDetail,
  type WorkoutTemplateDetail,
  type WorkoutTemplateExercise
} from "../../shared/api/workout";
import { formatTemplateDuration } from "./trainingHubUtils";

type ExerciseMapItem = {
  id: number;
  name: string;
  imageUrl: string;
};

const resolveStructure = (exercises: WorkoutTemplateExercise[]) => {
  if (!exercises.length) {
    return { workSeconds: 40, restSeconds: 20, label: "40s Work / 20s Rest" };
  }
  const workAccumulator = exercises.reduce((acc, item) => {
    const work = item.timeSeconds > 0 ? item.timeSeconds : Math.max(item.reps * 2, 20);
    return acc + work;
  }, 0);
  const restAccumulator = exercises.reduce((acc, item) => acc + Math.max(item.restSeconds, 0), 0);
  const workSeconds = Math.max(10, Math.round(workAccumulator / exercises.length));
  const restSeconds = Math.max(5, Math.round(restAccumulator / exercises.length));
  return {
    workSeconds,
    restSeconds,
    label: `${workSeconds}s Work / ${restSeconds}s Rest`
  };
};

export function ModuleDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<WorkoutTemplateDetail | null>(null);
  const [exerciseMap, setExerciseMap] = useState<Map<number, ExerciseMapItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const templateId = useMemo(() => {
    const parsed = Number(params.id);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [params.id]);

  useEffect(() => {
    if (!templateId) {
      setError("Invalid module id.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [template, exerciseList] = await Promise.all([
          fetchWorkoutTemplateDetail(templateId),
          fetchExerciseList({ page: 1, pageSize: 2000 })
        ]);
        if (cancelled) return;
        if (template.templateKind !== "module") {
          setError("This template is not a quick module.");
          setLoading(false);
          return;
        }
        setDetail(template);
        const nextMap = new Map<number, ExerciseMapItem>();
        exerciseCatalog.forEach((item) => {
          const numericId = Number(item.id);
          if (!Number.isFinite(numericId) || numericId <= 0) return;
          nextMap.set(numericId, {
            id: numericId,
            name: item.name,
            imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : ""
          });
        });
        exerciseList.list.forEach((item) => {
          const numericId = Number(item.id);
          if (!Number.isFinite(numericId) || numericId <= 0) return;
          const existing = nextMap.get(numericId);
          nextMap.set(numericId, {
            id: numericId,
            name: item.name?.trim() || existing?.name || `Exercise #${numericId}`,
            imageUrl: item.imageUrl || existing?.imageUrl || ""
          });
        });
        setExerciseMap(nextMap);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load module detail.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const structure = useMemo(
    () => resolveStructure(detail?.exercises ?? []),
    [detail?.exercises]
  );

  const coverImage = useMemo(() => {
    if (!detail?.exercises?.length) return "";
    for (const item of detail.exercises) {
      const matched = exerciseMap.get(item.exerciseId);
      if (matched?.imageUrl) {
        return matched.imageUrl;
      }
    }
    return "";
  }, [detail?.exercises, exerciseMap]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090d] px-6 py-10 text-zinc-100">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-zinc-400">
          Loading module detail...
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-[#07090d] px-6 py-10 text-zinc-100">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6">
          <p className="text-sm text-rose-200">{error ?? "Module not found."}</p>
          <Link to="/modules" className="mt-4 inline-block text-sm text-zinc-200 hover:text-white">
            Back to modules
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07090d] text-zinc-100">
      <div className="absolute left-0 right-0 top-0 -z-10 h-[50vh] blur-[120px]">
        <div className="h-full w-full bg-[radial-gradient(circle_at_50%_0%,rgba(163,230,53,0.18),transparent_72%)]" />
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
        <Link
          to="/modules"
          className="mb-10 inline-flex w-fit items-center gap-2 text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Back</span>
        </Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          {coverImage ? (
            <div className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-black/30">
              <img src={coverImage} alt={detail.templateName} className="h-64 w-full object-cover" />
            </div>
          ) : null}

          <h1 className="mb-4 text-4xl font-black leading-[1.1] tracking-tight text-white sm:text-5xl">
            {detail.templateName}
          </h1>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur-md">
              <Clock className="h-5 w-5 text-zinc-400" />
              <span className="text-base font-semibold">
                {formatTemplateDuration(detail.exercises)}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur-md">
              <Activity className="h-5 w-5 text-lime-300" />
              <span className="text-base font-semibold text-lime-100">{structure.label}</span>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <h3 className="mb-5 text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">
            Circuit Preview
          </h3>
          <div className="space-y-3">
            {detail.exercises.map((exercise, index) => {
              const mapped = exerciseMap.get(exercise.exerciseId);
              const safeSets = Math.max(1, Math.round(exercise.sets || 0));
              const safeReps = Math.max(0, Math.round(exercise.reps || 0));
              const safeRest = Math.max(0, Math.round(exercise.restSeconds || 0));
              const safeTime = Math.max(0, Math.round(exercise.timeSeconds || 0));
              const safeRounds = Math.max(1, Math.round(exercise.rounds || 0));
              const exerciseName = mapped?.name ?? `Exercise #${exercise.exerciseId}`;
              return (
                <div
                  key={`${exercise.exerciseId}-${exercise.orderIndex}-${index}`}
                  className="group rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex items-start gap-4">
                    <span className="w-8 pt-1 text-xl font-bold text-zinc-600">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-medium text-zinc-200 group-hover:text-white">
                        {exerciseName}
                      </p>
                      {mapped?.imageUrl ? (
                        <img
                          src={mapped.imageUrl}
                          alt={exerciseName}
                          className="mt-2 h-28 w-full rounded-lg border border-white/10 object-cover sm:h-32"
                          loading="lazy"
                        />
                      ) : null}
                      <div className="mt-2 flex flex-nowrap gap-1.5 overflow-x-auto pb-1 text-[10px] text-zinc-300 whitespace-nowrap">
                        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                          Sets {safeSets}
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                          Reps {safeReps}
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                          Rest {safeRest}s
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                          Time {safeTime}s
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                          Rnd {safeRounds}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 28, delay: 0.2 }}
          className="sticky bottom-6 mt-12"
        >
          <button
            className="group relative w-full overflow-hidden rounded-[2rem] p-[2px]"
            onClick={() => {
              if (typeof window === "undefined") return;
              window.localStorage.removeItem("workoutActiveSessionId");
              window.localStorage.removeItem("workoutActiveRunId");
              window.localStorage.removeItem("workoutActiveRunSessionId");
              window.localStorage.setItem(
                "quickModuleActive",
                JSON.stringify({
                  id: String(detail.id),
                  title: detail.templateName,
                  duration: formatTemplateDuration(detail.exercises),
                  structure: structure.label,
                  workSeconds: structure.workSeconds,
                  restSeconds: structure.restSeconds,
                  exercises: detail.exercises.map((item) => ({
                    name: exerciseMap.get(item.exerciseId)?.name ?? `Exercise #${item.exerciseId}`,
                    reps: item.timeSeconds > 0 ? `${item.timeSeconds}s` : `${item.reps} reps`
                  }))
                })
              );
              navigate("/workout");
            }}
          >
            <span className="absolute inset-0 rounded-[2rem] bg-gradient-to-r from-lime-400 to-emerald-500 opacity-80 transition-opacity group-hover:opacity-100" />
            <div className="relative flex items-center justify-center gap-3 rounded-[calc(2rem-2px)] bg-zinc-950/90 px-8 py-5 backdrop-blur-xl transition-colors group-hover:bg-zinc-950/70">
              <Play className="h-6 w-6 fill-current text-white" />
              <span className="text-lg font-bold tracking-wide text-white">START MODULE</span>
            </div>
          </button>
        </motion.div>
      </div>
    </div>
  );
}
