import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Bookmark, Layers, Plus, Share2, Trash2 } from "lucide-react";
import { Badge } from "../../shared/components/ui/badge";
import { Button } from "../../shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../shared/components/ui/card";
import {
  createWorkoutTemplate,
  fetchWorkoutTemplateList,
  fetchWorkoutTemplateShareInfo,
  updateWorkoutTemplate,
  type WorkoutTemplateExercise,
  type WorkoutTemplateSummary
} from "../../shared/api/workout";
import { resolveWorkoutUserId } from "./trainingHubUtils";

type BlockExercise = {
  uid: string;
  id: string;
  name: string;
  sets: number;
  reps: number;
  rest: number;
  time: number;
  rounds: number;
  source: "cart" | "template";
};

type BlockGroup = {
  id: string;
  method: string;
  items: BlockExercise[];
};

type WorkoutBlock = {
  id: string;
  title: string;
  groups: BlockGroup[];
};

type LocalCourseTemplate = {
  id: string;
  name: string;
  style?: string;
  exerciseIds?: string[];
  backendTemplateId?: number;
  blocks?: WorkoutBlock[];
};

const LOCAL_TEMPLATE_KEY = "workoutTemplates";

const readLocalTemplates = (): LocalCourseTemplate[] => {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(LOCAL_TEMPLATE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as LocalCourseTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalTemplates = (templates: LocalCourseTemplate[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_TEMPLATE_KEY, JSON.stringify(templates));
};

const countTemplateExercises = (template: LocalCourseTemplate) => {
  if (template.blocks?.length) {
    return template.blocks.reduce(
      (acc, block) =>
        acc +
        block.groups.reduce((groupAcc, group) => groupAcc + group.items.length, 0),
      0
    );
  }
  return template.exerciseIds?.length ?? 0;
};

const toWorkoutTemplateExercises = (
  template: LocalCourseTemplate
): WorkoutTemplateExercise[] => {
  const rows: WorkoutTemplateExercise[] = [];
  let index = 1;
  if (template.blocks?.length) {
    template.blocks.forEach((block) => {
      block.groups.forEach((group) => {
        group.items.forEach((item) => {
          const exerciseId = Number(item.id);
          if (!Number.isFinite(exerciseId) || exerciseId <= 0) return;
          rows.push({
            exerciseId,
            sets: Math.max(1, Number(item.sets) || 1),
            reps: Math.max(0, Number(item.reps) || 0),
            restSeconds: Math.max(0, Number(item.rest) || 0),
            timeSeconds: Math.max(0, Number(item.time) || 0),
            rounds: Math.max(1, Number(item.rounds) || 1),
            orderIndex: index++
          });
        });
      });
    });
  }

  if (rows.length > 0) {
    return rows;
  }

  return (template.exerciseIds ?? [])
    .map((id, itemIndex) => {
      const exerciseId = Number(id);
      if (!Number.isFinite(exerciseId) || exerciseId <= 0) return null;
      return {
        exerciseId,
        sets: 3,
        reps: 10,
        restSeconds: 45,
        timeSeconds: 0,
        rounds: 1,
        orderIndex: itemIndex + 1
      } as WorkoutTemplateExercise;
    })
    .filter((item): item is WorkoutTemplateExercise => Boolean(item));
};

export function TemplateLibraryPage() {
  const navigate = useNavigate();
  const userId = resolveWorkoutUserId();
  const [templates, setTemplates] = useState<LocalCourseTemplate[]>([]);
  const [backendCourses, setBackendCourses] = useState<WorkoutTemplateSummary[]>([]);
  const [loadingBackend, setLoadingBackend] = useState(false);
  const [sharingKey, setSharingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTemplates(readLocalTemplates());
  }, []);

  const loadBackendCourses = async () => {
    setLoadingBackend(true);
    try {
      const list = await fetchWorkoutTemplateList(userId, "course");
      setBackendCourses(list);
    } catch {
      // keep local flow when backend list fails
    } finally {
      setLoadingBackend(false);
    }
  };

  useEffect(() => {
    loadBackendCourses();
  }, [userId]);

  const startCourseArrangement = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("workoutApplyTemplateId");
      window.localStorage.removeItem("workoutApplyTemplateBackendId");
    }
    navigate("/workout-style");
  };

  const applyTemplate = (templateId: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("workoutApplyTemplateId", templateId);
    navigate("/workout-builder");
  };

  const removeTemplate = (templateId: string) => {
    const next = templates.filter((item) => item.id !== templateId);
    setTemplates(next);
    writeLocalTemplates(next);
  };

  const copyShareUrlByTemplateId = async (templateId: number) => {
    const shareInfo = await fetchWorkoutTemplateShareInfo(templateId);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
    return shareInfo.sharePath.startsWith("http")
      ? shareInfo.sharePath
      : `${origin}${shareInfo.sharePath}`;
  };

  const handleShareBackendCourse = async (templateId: number) => {
    const shareKey = `backend-${templateId}`;
    setSharingKey(shareKey);
    setError(null);
    try {
      const shareUrl = await copyShareUrlByTemplateId(templateId);
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
      if (typeof window !== "undefined") {
        window.alert(`Share link copied:\n${shareUrl}`);
      }
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "Failed to share course.");
    } finally {
      setSharingKey(null);
    }
  };

  const handleShareLocalTemplate = async (template: LocalCourseTemplate) => {
    const shareKey = `local-${template.id}`;
    setSharingKey(shareKey);
    setError(null);
    try {
      let backendTemplateId = template.backendTemplateId;
      const exercises = toWorkoutTemplateExercises(template);
      if (exercises.length === 0) {
        throw new Error("This local arrangement has no valid exercises to share.");
      }
      if (!backendTemplateId) {
        const created = await createWorkoutTemplate({
          userId,
          templateName: template.name,
          templateKind: "course",
          exercises
        });
        backendTemplateId = created.id;
        const nextTemplates = templates.map((item) =>
          item.id === template.id ? { ...item, backendTemplateId } : item
        );
        setTemplates(nextTemplates);
        writeLocalTemplates(nextTemplates);
        await loadBackendCourses();
      } else {
        await updateWorkoutTemplate(backendTemplateId, {
          templateName: template.name,
          templateKind: "course",
          exercises
        });
      }

      const shareUrl = await copyShareUrlByTemplateId(backendTemplateId);
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
      if (typeof window !== "undefined") {
        window.alert(`Share link copied:\n${shareUrl}`);
      }
    } catch (shareError) {
      setError(
        shareError instanceof Error ? shareError.message : "Failed to publish/share arrangement."
      );
    } finally {
      setSharingKey(null);
    }
  };

  const applyBackendCourse = (templateId: number) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("workoutApplyTemplateBackendId", String(templateId));
    navigate("/workout-builder");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">TrainingHub</p>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Course Arrangement</h1>
          <p className="text-sm text-zinc-400">
            先选训练风格，再进入编排器自定义课程；保存后可在这里直接 Apply。
          </p>
        </header>

        <Card className="border-emerald-400/20 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="text-lg text-white">Create Flow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Step 1</p>
                <p className="mt-2 text-sm text-zinc-200">Choose training style</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Step 2</p>
                <p className="mt-2 text-sm text-zinc-200">Arrange blocks and exercises</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Step 3</p>
                <p className="mt-2 text-sm text-zinc-200">Save and reuse with Apply</p>
              </div>
            </div>
            <Button
              type="button"
              onClick={startCourseArrangement}
              className="rounded-xl bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
            >
              <Plus className="h-4 w-4" />
              Start New Course Arrangement
            </Button>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardHeader>
            <CardTitle className="text-lg text-white">Saved Arrangements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {templates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/60 p-6 text-sm text-zinc-500">
                No saved arrangement yet. Create one from style selection and save in builder.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 shadow-[0_15px_30px_rgba(0,0,0,0.35)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Bookmark className="h-4 w-4 text-emerald-300" />
                          <p className="text-sm font-semibold text-white">{template.name}</p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                          <Badge className="bg-zinc-800 text-zinc-300">
                            {countTemplateExercises(template)} exercises
                          </Badge>
                          <Badge className="bg-zinc-800 text-zinc-300">
                            {template.blocks?.length ?? 0} blocks
                          </Badge>
                          {template.style ? (
                            <Badge className="bg-zinc-800 text-zinc-300">{template.style}</Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-zinc-400 hover:text-emerald-300"
                          onClick={() => handleShareLocalTemplate(template)}
                          disabled={sharingKey === `local-${template.id}`}
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-zinc-400 hover:text-rose-300"
                          onClick={() => removeTemplate(template.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => applyTemplate(template.id)}
                        className="w-full rounded-xl bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                      >
                        Apply to Builder
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardHeader>
            <CardTitle className="text-lg text-white">Cloud Course Templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingBackend ? (
              <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/60 p-6 text-sm text-zinc-500">
                Loading backend courses...
              </div>
            ) : backendCourses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/60 p-6 text-sm text-zinc-500">
                No backend course templates yet. Share a local arrangement once to publish it.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {backendCourses.map((course) => (
                  <div
                    key={course.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 shadow-[0_15px_30px_rgba(0,0,0,0.35)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Bookmark className="h-4 w-4 text-emerald-300" />
                          <p className="text-sm font-semibold text-white">{course.templateName}</p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                          <Badge className="bg-zinc-800 text-zinc-300">course</Badge>
                          {course.shareCode ? (
                            <Badge className="bg-zinc-800 font-mono text-zinc-300">
                              {course.shareCode}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-zinc-400 hover:text-emerald-300"
                        onClick={() => handleShareBackendCourse(course.id)}
                        disabled={sharingKey === `backend-${course.id}`}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => applyBackendCourse(course.id)}
                        className="w-full rounded-xl bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                      >
                        Apply to Builder
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {error ? (
          <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button
            asChild
            variant="ghost"
            className="rounded-xl border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
          >
            <Link to="/workout-style">
              <Layers className="mr-2 h-4 w-4" />
              Choose Style
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="rounded-xl border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
          >
            <Link to="/workout-builder">Open Builder</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
