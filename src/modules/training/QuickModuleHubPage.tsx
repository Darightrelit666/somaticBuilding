import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Clock3, PencilLine, Plus, Share2, Trash2 } from "lucide-react";
import { Badge } from "../../shared/components/ui/badge";
import { Button } from "../../shared/components/ui/button";
import { Input } from "../../shared/components/ui/input";
import { fetchExerciseList } from "../../shared/api/exercises";
import { exercises as exerciseCatalog } from "../../shared/data/exercises";
import {
  createWorkoutTemplate,
  deleteWorkoutTemplate,
  fetchWorkoutTemplateDetail,
  fetchWorkoutTemplateList,
  fetchWorkoutTemplateShareInfo,
  updateWorkoutTemplate,
  type WorkoutTemplateDetail,
  type WorkoutTemplateExercise,
  type WorkoutTemplateSummary
} from "../../shared/api/workout";
import { formatTemplateDuration, resolveWorkoutUserId } from "./trainingHubUtils";

type ExerciseOption = {
  id: number;
  name: string;
  imageUrl: string;
};

type ModuleExerciseDraft = WorkoutTemplateExercise;

const AI_QUICK_MODULE_DRAFT_KEY = "aiQuickModuleDraft";

const createDefaultExerciseDraft = (exerciseId: number, orderIndex: number): ModuleExerciseDraft => ({
  exerciseId,
  sets: 3,
  reps: 10,
  restSeconds: 45,
  timeSeconds: 0,
  rounds: 1,
  orderIndex
});

export function QuickModuleHubPage() {
  const [modules, setModules] = useState<WorkoutTemplateSummary[]>([]);
  const [moduleDetailsById, setModuleDetailsById] = useState<Record<number, WorkoutTemplateDetail>>({});
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sharingTemplateId, setSharingTemplateId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
  const [draftExercises, setDraftExercises] = useState<ModuleExerciseDraft[]>([]);

  const userId = useMemo(() => resolveWorkoutUserId(), []);

  const resetForm = () => {
    setEditingTemplateId(null);
    setTemplateName("");
    setSelectedExerciseId(null);
    setDraftExercises([]);
  };

  const loadModules = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchWorkoutTemplateList(userId, "module");
      setModules(list);
      const details = await Promise.all(
        list.map(async (item) => {
          try {
            const detail = await fetchWorkoutTemplateDetail(item.id);
            return detail;
          } catch {
            return null;
          }
        })
      );
      const nextMap: Record<number, WorkoutTemplateDetail> = {};
      details.forEach((detail) => {
        if (detail) {
          nextMap[detail.id] = detail;
        }
      });
      setModuleDetailsById(nextMap);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load quick modules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      try {
        const result = await fetchExerciseList({ page: 1, pageSize: 2000 });
        if (cancelled) return;
        const optionMap = new Map<number, ExerciseOption>();
        exerciseCatalog.forEach((item) => {
          const numericId = Number(item.id);
          if (!Number.isFinite(numericId) || numericId <= 0) return;
          optionMap.set(numericId, {
            id: numericId,
            name: item.name,
            imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : ""
          });
        });
        result.list.forEach((item) => {
          const numericId = Number(item.id);
          if (!Number.isFinite(numericId) || numericId <= 0) return;
          const existing = optionMap.get(numericId);
          optionMap.set(numericId, {
            id: numericId,
            name: item.name?.trim() || existing?.name || `Exercise #${numericId}`,
            imageUrl: item.imageUrl || existing?.imageUrl || ""
          });
        });
        const options = [...optionMap.values()].sort((a, b) => a.id - b.id);
        setExerciseOptions(options);
        if (options.length > 0) {
          setSelectedExerciseId(options[0].id);
        }
      } catch {
        // ignore exercise list failure, module CRUD still works with manual IDs
      }
      if (!cancelled) {
        await loadModules();
      }
    };
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(AI_QUICK_MODULE_DRAFT_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        templateName?: string;
        exercises?: Array<Partial<ModuleExerciseDraft>>;
      };
      const incomingRows: ModuleExerciseDraft[] = Array.isArray(parsed.exercises)
        ? parsed.exercises
            .map((item, index) => ({
              exerciseId: Number(item.exerciseId),
              sets: Number(item.sets) > 0 ? Number(item.sets) : 3,
              reps: Number(item.reps) > 0 ? Number(item.reps) : 10,
              restSeconds: Number(item.restSeconds) >= 0 ? Number(item.restSeconds) : 45,
              timeSeconds: Number(item.timeSeconds) >= 0 ? Number(item.timeSeconds) : 0,
              rounds: Number(item.rounds) > 0 ? Number(item.rounds) : 1,
              orderIndex: Number(item.orderIndex) > 0 ? Number(item.orderIndex) : index + 1
            }))
            .filter((item) => Number.isFinite(item.exerciseId) && item.exerciseId > 0)
        : [];

      if (incomingRows.length > 0) {
        setEditingTemplateId(null);
        setTemplateName(
          typeof parsed.templateName === "string" && parsed.templateName.trim()
            ? parsed.templateName.trim()
            : "AI Quick Module"
        );
        setDraftExercises(incomingRows);
      }
    } catch {
      // ignore malformed draft payload
    } finally {
      window.localStorage.removeItem(AI_QUICK_MODULE_DRAFT_KEY);
    }
  }, []);

  const addDraftExercise = () => {
    if (!selectedExerciseId) return;
    setDraftExercises((prev) => [
      ...prev,
      createDefaultExerciseDraft(selectedExerciseId, prev.length + 1)
    ]);
  };

  const removeDraftExercise = (index: number) => {
    setDraftExercises((prev) =>
      prev
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, orderIndex: itemIndex + 1 }))
    );
  };

  const updateDraftExercise = (
    index: number,
    key: keyof Omit<ModuleExerciseDraft, "exerciseId" | "orderIndex">,
    value: number
  ) => {
    setDraftExercises((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: Number.isFinite(value) ? value : 0 } : item
      )
    );
  };

  const handleCreateMode = () => {
    resetForm();
  };

  const handleEditMode = async (templateId: number) => {
    setSaving(true);
    setError(null);
    try {
      const detail = await fetchWorkoutTemplateDetail(templateId);
      setEditingTemplateId(templateId);
      setTemplateName(detail.templateName);
      setDraftExercises(
        detail.exercises.map((item, index) => ({
          ...item,
          orderIndex: index + 1
        }))
      );
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Failed to load module detail.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId: number) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Delete this module?");
      if (!confirmed) return;
    }
    setSaving(true);
    setError(null);
    try {
      await deleteWorkoutTemplate(templateId);
      if (editingTemplateId === templateId) {
        resetForm();
      }
      await loadModules();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete module.");
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async (templateId: number) => {
    setSharingTemplateId(templateId);
    setError(null);
    try {
      const shareInfo = await fetchWorkoutTemplateShareInfo(templateId);
      const origin =
        typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
      const shareUrl = shareInfo.sharePath.startsWith("http")
        ? shareInfo.sharePath
        : `${origin}${shareInfo.sharePath}`;
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
      if (typeof window !== "undefined") {
        window.alert(`Share link copied:\n${shareUrl}`);
      }
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "Failed to create share link.");
    } finally {
      setSharingTemplateId(null);
    }
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      setError("Please enter module name.");
      return;
    }
    if (draftExercises.length === 0) {
      setError("Please add at least one exercise.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingTemplateId) {
        await updateWorkoutTemplate(editingTemplateId, {
          templateName: templateName.trim(),
          templateKind: "module",
          exercises: draftExercises
        });
      } else {
        await createWorkoutTemplate({
          userId,
          templateName: templateName.trim(),
          templateKind: "module",
          exercises: draftExercises
        });
      }
      await loadModules();
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save module.");
    } finally {
      setSaving(false);
    }
  };

  const exerciseMetaMap = useMemo(() => {
    return new Map(exerciseOptions.map((item) => [item.id, item]));
  }, [exerciseOptions]);

  return (
    <div className="min-h-screen bg-[#07090d] pb-20 text-zinc-100">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <motion.header
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">TrainingHub</p>
            <h1 className="text-4xl font-extrabold tracking-tight text-white">Quick Modules</h1>
            <p className="text-sm text-zinc-400">
              Build your own quick module and run it directly from module detail.
            </p>
          </motion.header>

          <div className="flex items-center justify-between">
            <Badge className="border-lime-400/30 bg-lime-400/10 text-lime-300">
              {modules.length} modules
            </Badge>
            <Button
              type="button"
              onClick={handleCreateMode}
              className="rounded-xl bg-lime-400 text-zinc-950 hover:bg-lime-300"
            >
              <Plus className="h-4 w-4" />
              New Module
            </Button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-zinc-400">
              Loading modules...
            </div>
          ) : modules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-zinc-400">
              No quick modules yet. Create your first one from the right panel.
            </div>
          ) : (
            <div className="grid gap-4">
              {modules.map((moduleItem) => {
                const detail = moduleDetailsById[moduleItem.id];
                const exerciseCount = detail?.exercises.length ?? 0;
                return (
                  <div
                    key={moduleItem.id}
                    className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.25)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <p className="text-xl font-semibold text-white">{moduleItem.templateName}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {detail ? formatTemplateDuration(detail.exercises) : "Estimated"}
                          </span>
                          <span className="rounded-full border border-white/10 px-2.5 py-1">
                            {exerciseCount} exercises
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-zinc-400 hover:text-emerald-200"
                          onClick={() => handleShare(moduleItem.id)}
                          disabled={sharingTemplateId === moduleItem.id}
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-zinc-400 hover:text-white"
                          onClick={() => handleEditMode(moduleItem.id)}
                        >
                          <PencilLine className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-zinc-400 hover:text-rose-300"
                          onClick={() => handleDelete(moduleItem.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-5">
                      <Button
                        asChild
                        className="w-full rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200"
                      >
                        <Link to={`/module/${moduleItem.id}`}>View Details</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Module Editor</p>
            <h2 className="text-2xl font-semibold text-white">
              {editingTemplateId ? "Edit Module" : "Create Module"}
            </h2>
          </div>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="module-name" className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Module Name
              </label>
              <Input
                id="module-name"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                className="border-white/10 bg-black/40 text-white"
                placeholder="e.g. Posterior Chain Ignite"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Add Exercise</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <select
                  value={selectedExerciseId ?? ""}
                  onChange={(event) => setSelectedExerciseId(Number(event.target.value))}
                  className="h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 text-sm text-zinc-100 outline-none"
                >
                  {exerciseOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  onClick={addDraftExercise}
                  className="rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200"
                >
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {draftExercises.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-500">
                  No exercises yet.
                </div>
              ) : (
                draftExercises.map((item, index) => (
                  <div key={`${item.exerciseId}-${index}`} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    {(() => {
                      const exerciseMeta = exerciseMetaMap.get(item.exerciseId);
                      const exerciseName = exerciseMeta?.name ?? `Exercise #${item.exerciseId}`;
                      return (
                        <>
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-white">{exerciseName}</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-zinc-400 hover:text-rose-300"
                              onClick={() => removeDraftExercise(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {exerciseMeta?.imageUrl ? (
                            <div className="relative mb-2 block w-full overflow-hidden rounded-lg border border-white/10">
                              <div
                                className="absolute inset-0 scale-110 bg-cover bg-center blur-md"
                                style={{ backgroundImage: `url(${exerciseMeta.imageUrl})` }}
                              />
                              <div className="absolute inset-0 bg-black/25" />
                              <img
                                src={exerciseMeta.imageUrl}
                                alt={exerciseName}
                                className="relative z-10 h-auto w-full object-contain"
                                loading="lazy"
                              />
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                    <div className="mb-2 flex flex-nowrap gap-1 overflow-x-auto pb-1 text-[10px] text-zinc-300 whitespace-nowrap">
                      <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                        Sets {Math.max(1, item.sets)}
                      </span>
                      <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                        Reps {Math.max(0, item.reps)}
                      </span>
                      <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                        Rest {Math.max(0, item.restSeconds)}s
                      </span>
                      <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                        Time {Math.max(0, item.timeSeconds)}s
                      </span>
                      <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                        Rnd {Math.max(1, item.rounds)}
                      </span>
                    </div>
                    <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 text-xs whitespace-nowrap">
                      <label className="min-w-[96px] space-y-1">
                        <span className="text-zinc-500">Sets</span>
                        <Input
                          type="number"
                          min={1}
                          value={item.sets}
                          onChange={(event) =>
                            updateDraftExercise(index, "sets", Number(event.target.value))
                          }
                          className="h-8 border-white/10 bg-black/50 text-white"
                        />
                      </label>
                      <label className="min-w-[96px] space-y-1">
                        <span className="text-zinc-500">Reps</span>
                        <Input
                          type="number"
                          min={0}
                          value={item.reps}
                          onChange={(event) =>
                            updateDraftExercise(index, "reps", Number(event.target.value))
                          }
                          className="h-8 border-white/10 bg-black/50 text-white"
                        />
                      </label>
                      <label className="min-w-[96px] space-y-1">
                        <span className="text-zinc-500">Rest(s)</span>
                        <Input
                          type="number"
                          min={0}
                          value={item.restSeconds}
                          onChange={(event) =>
                            updateDraftExercise(index, "restSeconds", Number(event.target.value))
                          }
                          className="h-8 border-white/10 bg-black/50 text-white"
                        />
                      </label>
                      <label className="min-w-[96px] space-y-1">
                        <span className="text-zinc-500">Time(s)</span>
                        <Input
                          type="number"
                          min={0}
                          value={item.timeSeconds}
                          onChange={(event) =>
                            updateDraftExercise(index, "timeSeconds", Number(event.target.value))
                          }
                          className="h-8 border-white/10 bg-black/50 text-white"
                        />
                      </label>
                      <label className="min-w-[96px] space-y-1">
                        <span className="text-zinc-500">Rounds</span>
                        <Input
                          type="number"
                          min={1}
                          value={item.rounds}
                          onChange={(event) =>
                            updateDraftExercise(index, "rounds", Number(event.target.value))
                          }
                          className="h-8 border-white/10 bg-black/50 text-white"
                        />
                      </label>
                    </div>
                  </div>
                ))
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-xl bg-lime-400 text-zinc-950 hover:bg-lime-300"
              >
                {saving ? "Saving..." : editingTemplateId ? "Save Changes" : "Create Module"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={resetForm}
                className="rounded-xl border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
              >
                Reset
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
