import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowRight, Copy, ExternalLink, Loader2, Save, Share2 } from "lucide-react";
import { Button } from "../../shared/components/ui/button";
import { Badge } from "../../shared/components/ui/badge";
import {
  createWorkoutTemplate,
  fetchSharedWorkoutTemplateDetail,
  type WorkoutTemplateDetail
} from "../../shared/api/workout";
import { formatTemplateDuration, resolveWorkoutUserId } from "./trainingHubUtils";

export function SharedTemplatePage() {
  const { shareCode } = useParams();
  const navigate = useNavigate();
  const userId = useMemo(() => resolveWorkoutUserId(), []);
  const [template, setTemplate] = useState<WorkoutTemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!shareCode) {
          throw new Error("Missing share code.");
        }
        const detail = await fetchSharedWorkoutTemplateDetail(shareCode);
        if (!cancelled) {
          setTemplate(detail);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load shared template."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [shareCode]);

  const copyCurrentLink = async () => {
    if (typeof window === "undefined") return;
    const link = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      }
      window.alert(`Share link copied:\n${link}`);
    } catch {
      window.alert(link);
    }
  };

  const applyDirectly = () => {
    if (!template || typeof window === "undefined") return;
    if (template.templateKind === "module") {
      navigate(`/module/${template.id}`);
      return;
    }
    window.localStorage.setItem("workoutApplyTemplateBackendId", String(template.id));
    navigate("/workout-builder");
  };

  const saveToMyTemplates = async () => {
    if (!template) return;
    setSaving(true);
    setError(null);
    try {
      const nextName = `${template.templateName} (Shared)`;
      const created = await createWorkoutTemplate({
        userId,
        templateName: nextName,
        templateKind: template.templateKind,
        exercises: template.exercises
      });

      if (typeof window !== "undefined") {
        if (template.templateKind === "course") {
          window.localStorage.setItem("workoutApplyTemplateBackendId", String(created.id));
          navigate("/workout-builder");
        } else {
          navigate(`/module/${created.id}`);
        }
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save shared template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090d] text-zinc-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-12">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Share</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Shared Template</h1>
          <p className="text-sm text-zinc-400">
            Open, apply, or save this shared course/module into your own training library.
          </p>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-sm text-zinc-300">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading shared template...
            </span>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-6 text-sm text-rose-200">
            {error}
          </div>
        ) : template ? (
          <div className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">{template.templateName}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
                    {template.templateKind.toUpperCase()}
                  </Badge>
                  <Badge className="border-white/15 bg-white/5 text-zinc-300">
                    {template.exercises.length} exercises
                  </Badge>
                  <Badge className="border-white/15 bg-white/5 text-zinc-300">
                    {formatTemplateDuration(template.exercises)}
                  </Badge>
                  {template.shareCode ? (
                    <Badge className="border-white/15 bg-white/5 font-mono text-zinc-300">
                      {template.shareCode}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                  onClick={copyCurrentLink}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                  onClick={applyDirectly}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Apply Directly
                </Button>
                <Button
                  type="button"
                  onClick={saveToMyTemplates}
                  disabled={saving}
                  className="bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save To My Templates
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-500">
                Exercise Structure
              </p>
              {template.exercises.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-black/30 p-3 text-sm text-zinc-500">
                  This template has no exercises.
                </div>
              ) : (
                <div className="space-y-2">
                  {template.exercises
                    .sort((a, b) => a.orderIndex - b.orderIndex)
                    .map((item, index) => (
                      <div
                        key={`${item.exerciseId}-${index}`}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">
                            Exercise #{item.exerciseId}
                          </p>
                          <span className="text-xs text-zinc-500">#{item.orderIndex}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-300">
                          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                            Sets {item.sets}
                          </span>
                          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                            Reps {item.reps}
                          </span>
                          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                            Rest {item.restSeconds}s
                          </span>
                          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                            Time {item.timeSeconds}s
                          </span>
                          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                            Rounds {item.rounds}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            asChild
            variant="ghost"
            className="border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
          >
            <Link to="/training">
              Back to Training Hub
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
          >
            <Link to="/modules">
              <Share2 className="mr-2 h-4 w-4" />
              Browse Modules
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
