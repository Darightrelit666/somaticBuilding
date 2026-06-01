import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { CalendarDays, GripVertical, PencilLine, Trash2, WandSparkles } from "lucide-react";
import { Badge } from "../../shared/components/ui/badge";
import { Button } from "../../shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../shared/components/ui/card";
import { Input } from "../../shared/components/ui/input";
import {
  fetchWorkoutTemplateList,
  type WorkoutTemplateKind,
  type WorkoutTemplateSummary
} from "../../shared/api/workout";
import { resolveWorkoutUserId } from "./trainingHubUtils";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type ProgramDaySlot = {
  dayKey: DayKey;
  moduleId: number | null;
  courseId: number | null;
  focus: string;
};

type PlannerDaySlot = {
  dayIndex: number;
  moduleId: number | null;
  courseId: number | null;
  focus: string;
};

type WeeklyProgram = {
  id: string;
  name: string;
  weekStart: string;
  slots: ProgramDaySlot[];
  createdAt: string;
  updatedAt: string;
};

type DayLoadLevel = "rest" | "low" | "moderate" | "high";

type PlannerDayLoad = {
  dayIndex: number;
  level: DayLoadLevel;
  score: number;
  tags: string[];
  hasLowerBodyFocus: boolean;
  hasRecoveryFocus: boolean;
  hasAssignment: boolean;
};

type ProgramLoadAssessment = {
  days: PlannerDayLoad[];
  activeDays: number;
  restDays: number;
  lowDays: number;
  moderateDays: number;
  highDays: number;
  recoveryDays: number;
  maxHighStreak: number;
  balanceScore: number;
  warnings: string[];
  suggestions: string[];
  criticalIssues: string[];
};

type DragPayload = {
  source: "pool" | "day";
  kind: WorkoutTemplateKind;
  templateId: number;
  fromDayIndex?: number;
};

const STORAGE_KEY = "trainingHubWeeklyPrograms";
const DRAG_MIME = "application/x-somatic-program-template";
const DAY_COUNT = 7;

const HIGH_LOAD_KEYWORDS = [
  "strength",
  "power",
  "heavy",
  "crossfit",
  "wod",
  "hiit",
  "conditioning",
  "sprint",
  "plyo",
  "hypertrophy",
  "metcon",
  "explosive"
];

const MODERATE_LOAD_KEYWORDS = [
  "functional",
  "athletic",
  "skill",
  "technique",
  "stability",
  "core",
  "movement"
];

const RECOVERY_KEYWORDS = [
  "mobility",
  "yoga",
  "rehab",
  "recovery",
  "corrective",
  "stretch",
  "breath",
  "flow"
];

const LOWER_BODY_KEYWORDS = [
  "squat",
  "deadlift",
  "lunge",
  "hinge",
  "leg",
  "lower body",
  "glute",
  "hamstring",
  "quad",
  "ankle",
  "knee",
  "hip"
];

const VALID_DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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

const dayKeyFromDate = (date: Date): DayKey => {
  const map: Record<number, DayKey> = {
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

const includesAny = (source: string, keywords: string[]) =>
  keywords.some((keyword) => source.includes(keyword));

const normalizeText = (value: string) => value.trim().toLowerCase();

const createDefaultPlannerSlots = (): PlannerDaySlot[] =>
  Array.from({ length: DAY_COUNT }, (_, index) => ({
    dayIndex: index,
    moduleId: null,
    courseId: null,
    focus: ""
  }));

const normalizeProgramSlots = (slots: ProgramDaySlot[]) => {
  const map = new Map<DayKey, ProgramDaySlot>();
  slots.forEach((slot) => {
    if (!slot || !VALID_DAY_KEYS.includes(slot.dayKey)) return;
    map.set(slot.dayKey, {
      dayKey: slot.dayKey,
      moduleId:
        typeof slot.moduleId === "number" && Number.isFinite(slot.moduleId) ? slot.moduleId : null,
      courseId:
        typeof slot.courseId === "number" && Number.isFinite(slot.courseId) ? slot.courseId : null,
      focus: typeof slot.focus === "string" ? slot.focus : ""
    });
  });

  return VALID_DAY_KEYS.map((dayKey) => map.get(dayKey) ?? { dayKey, moduleId: null, courseId: null, focus: "" });
};

const convertProgramSlotsToPlannerSlots = (weekStart: string, slots: ProgramDaySlot[]) => {
  const startDate = parseDateOnly(weekStart) ?? new Date();
  const normalized = normalizeProgramSlots(slots);
  const byKey = new Map<DayKey, ProgramDaySlot>(normalized.map((slot) => [slot.dayKey, slot]));
  return Array.from({ length: DAY_COUNT }, (_, index) => {
    const dayKey = dayKeyFromDate(addDays(startDate, index));
    const slot = byKey.get(dayKey) ?? { dayKey, moduleId: null, courseId: null, focus: "" };
    return {
      dayIndex: index,
      moduleId: slot.moduleId,
      courseId: slot.courseId,
      focus: slot.focus
    };
  });
};

const convertPlannerSlotsToProgramSlots = (weekStart: string, plannerSlots: PlannerDaySlot[]) => {
  const startDate = parseDateOnly(weekStart) ?? new Date();
  return plannerSlots.map((slot) => {
    const dayDate = addDays(startDate, slot.dayIndex);
    return {
      dayKey: dayKeyFromDate(dayDate),
      moduleId: slot.moduleId,
      courseId: slot.courseId,
      focus: slot.focus
    };
  });
};

const loadLabel = (level: DayLoadLevel) => {
  switch (level) {
    case "high":
      return "High";
    case "moderate":
      return "Moderate";
    case "low":
      return "Low";
    default:
      return "Rest";
  }
};

const loadBadgeClass = (level: DayLoadLevel) => {
  switch (level) {
    case "high":
      return "border-rose-400/30 bg-rose-500/15 text-rose-200";
    case "moderate":
      return "border-amber-300/30 bg-amber-400/15 text-amber-100";
    case "low":
      return "border-sky-300/30 bg-sky-400/15 text-sky-100";
    default:
      return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
  }
};

const loadBarClass = (level: DayLoadLevel) => {
  switch (level) {
    case "high":
      return "bg-rose-400";
    case "moderate":
      return "bg-amber-300";
    case "low":
      return "bg-sky-300";
    default:
      return "bg-zinc-500/40";
  }
};

const loadBarWidth = (level: DayLoadLevel, score: number) => {
  if (level === "rest") return 12;
  return clamp(score * 10, 18, 100);
};

const readPrograms = (): WeeklyProgram[] => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as WeeklyProgram[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: String(item.id ?? `program-${Date.now()}`),
        name: String(item.name ?? "Untitled Program"),
        weekStart:
          typeof item.weekStart === "string" && parseDateOnly(item.weekStart)
            ? item.weekStart
            : toLocalDateKey(new Date()),
        slots: normalizeProgramSlots(Array.isArray(item.slots) ? item.slots : []),
        createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString()
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
};

const persistPrograms = (programs: WeeklyProgram[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(programs));
};

const findTemplateName = (list: WorkoutTemplateSummary[], id: number | null) => {
  if (!id) return "Not set";
  return list.find((item) => item.id === id)?.templateName ?? `Template #${id}`;
};

const assessProgramLoad = (
  slots: PlannerDaySlot[],
  moduleNameMap: Map<number, string>,
  courseNameMap: Map<number, string>
): ProgramLoadAssessment => {
  const days: PlannerDayLoad[] = slots.map((slot) => {
    const moduleName = slot.moduleId ? moduleNameMap.get(slot.moduleId) ?? "" : "";
    const courseName = slot.courseId ? courseNameMap.get(slot.courseId) ?? "" : "";
    const focus = slot.focus ?? "";
    const merged = normalizeText(`${moduleName} ${courseName} ${focus}`);

    const hasAssignment = Boolean(slot.moduleId || slot.courseId || focus.trim());
    if (!hasAssignment) {
      return {
        dayIndex: slot.dayIndex,
        level: "rest",
        score: 0,
        tags: [],
        hasLowerBodyFocus: false,
        hasRecoveryFocus: false,
        hasAssignment: false
      };
    }

    let score = 0;
    if (slot.moduleId) score += 2;
    if (slot.courseId) score += 3;
    if (slot.moduleId && slot.courseId) score += 1;

    const hasHighLoad = includesAny(merged, HIGH_LOAD_KEYWORDS);
    const hasModerateLoad = includesAny(merged, MODERATE_LOAD_KEYWORDS);
    const hasRecoveryFocus = includesAny(merged, RECOVERY_KEYWORDS);
    const hasLowerBodyFocus = includesAny(merged, LOWER_BODY_KEYWORDS);

    if (hasHighLoad) score += 3;
    if (hasModerateLoad) score += 1;
    if (hasRecoveryFocus) score -= 2;

    score = clamp(score, 0, 10);

    const tags: string[] = [];
    if (slot.courseId && slot.moduleId) tags.push("Dual load");
    if (hasHighLoad) tags.push("High intent");
    if (hasModerateLoad) tags.push("Skill/functional");
    if (hasRecoveryFocus) tags.push("Recovery");
    if (hasLowerBodyFocus) tags.push("Lower body");

    const level: DayLoadLevel = score === 0 ? "rest" : score <= 2 ? "low" : score <= 5 ? "moderate" : "high";

    return {
      dayIndex: slot.dayIndex,
      level,
      score,
      tags,
      hasLowerBodyFocus,
      hasRecoveryFocus,
      hasAssignment: true
    };
  });

  const activeDays = days.filter((day) => day.level !== "rest").length;
  const restDays = days.filter((day) => day.level === "rest").length;
  const lowDays = days.filter((day) => day.level === "low").length;
  const moderateDays = days.filter((day) => day.level === "moderate").length;
  const highDays = days.filter((day) => day.level === "high").length;
  const recoveryDays = days.filter((day) => day.hasRecoveryFocus || day.level === "low").length;

  let maxHighStreak = 0;
  let highStreak = 0;
  let hasConsecutiveLowerBodyLoad = false;
  for (let index = 0; index < days.length; index += 1) {
    const day = days[index];
    if (day.level === "high") {
      highStreak += 1;
      maxHighStreak = Math.max(maxHighStreak, highStreak);
    } else {
      highStreak = 0;
    }

    if (index > 0) {
      const previous = days[index - 1];
      const bothLowerBody =
        previous.hasLowerBodyFocus &&
        day.hasLowerBodyFocus &&
        previous.level !== "rest" &&
        day.level !== "rest";
      if (bothLowerBody) {
        hasConsecutiveLowerBodyLoad = true;
      }
    }
  }

  const warnings: string[] = [];
  if (restDays === 0) warnings.push("No rest day detected in this 7-day plan.");
  if (maxHighStreak >= 3) warnings.push(`High-intensity streak is ${maxHighStreak} days.`);
  if (highDays >= 4) warnings.push("High-intensity days are too frequent for one week.");
  if (recoveryDays === 0) warnings.push("No recovery-oriented day is scheduled.");
  if (hasConsecutiveLowerBodyLoad) warnings.push("Consecutive lower-body loading days were detected.");

  const suggestions: string[] = [];
  if (restDays === 0) suggestions.push("Insert at least one full rest day.");
  if (maxHighStreak >= 3) suggestions.push("Break high-intensity streaks with a low or recovery day.");
  if (recoveryDays === 0) suggestions.push("Add one mobility/rehab/technique-focused session.");
  if (activeDays < 3) suggestions.push("Raise frequency to at least 3 active days if possible.");
  if (activeDays > 6) suggestions.push("Consider reducing active days to improve recovery.");

  let balanceScore = 100;
  if (restDays === 0) balanceScore -= 20;
  if (highDays > 3) balanceScore -= (highDays - 3) * 8;
  if (maxHighStreak >= 3) balanceScore -= 12 + (maxHighStreak - 3) * 6;
  if (recoveryDays === 0) balanceScore -= 10;
  if (hasConsecutiveLowerBodyLoad) balanceScore -= 8;
  if (activeDays < 3) balanceScore -= 12;
  if (activeDays > 6) balanceScore -= 8;
  balanceScore = clamp(balanceScore, 0, 100);

  const criticalIssues: string[] = [];
  if (restDays === 0 && maxHighStreak >= 3) {
    criticalIssues.push("No rest day with prolonged high-intensity streak.");
  }
  if (highDays >= 5) {
    criticalIssues.push("Too many high-intensity days (>=5) for a single week.");
  }
  if (balanceScore < 35) {
    criticalIssues.push("Weekly balance score is below safe threshold.");
  }

  return {
    days,
    activeDays,
    restDays,
    lowDays,
    moderateDays,
    highDays,
    recoveryDays,
    maxHighStreak,
    balanceScore,
    warnings,
    suggestions,
    criticalIssues
  };
};

const parseDragPayload = (event: React.DragEvent<HTMLElement>): DragPayload | null => {
  const raw = event.dataTransfer.getData(DRAG_MIME);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as DragPayload;
    if (!payload || typeof payload !== "object") return null;
    if (payload.source !== "pool" && payload.source !== "day") return null;
    if (payload.kind !== "module" && payload.kind !== "course") return null;
    if (typeof payload.templateId !== "number" || !Number.isFinite(payload.templateId)) return null;
    return payload;
  } catch {
    return null;
  }
};

export function ProgramPlannerPage() {
  const [moduleOptions, setModuleOptions] = useState<WorkoutTemplateSummary[]>([]);
  const [courseOptions, setCourseOptions] = useState<WorkoutTemplateSummary[]>([]);
  const [programs, setPrograms] = useState<WeeklyProgram[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [programName, setProgramName] = useState("");
  const [editorWeekAnchor, setEditorWeekAnchor] = useState(() => toLocalDateKey(new Date()));
  const [plannerSlots, setPlannerSlots] = useState<PlannerDaySlot[]>(createDefaultPlannerSlots());

  const [templateQuery, setTemplateQuery] = useState("");
  const [templateKindFilter, setTemplateKindFilter] = useState<"all" | WorkoutTemplateKind>("all");
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [dragOverDayIndex, setDragOverDayIndex] = useState<number | null>(null);
  const [droppedPulseDayIndex, setDroppedPulseDayIndex] = useState<number | null>(null);
  const [copyPickerOpen, setCopyPickerOpen] = useState(false);
  const [copyQuery, setCopyQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = useMemo(() => resolveWorkoutUserId(), []);

  const moduleNameMap = useMemo(
    () => new Map(moduleOptions.map((item) => [item.id, item.templateName])),
    [moduleOptions]
  );
  const courseNameMap = useMemo(
    () => new Map(courseOptions.map((item) => [item.id, item.templateName])),
    [courseOptions]
  );

  const loadAssessment = useMemo(
    () => assessProgramLoad(plannerSlots, moduleNameMap, courseNameMap),
    [plannerSlots, moduleNameMap, courseNameMap]
  );

  const templatePool = useMemo(() => {
    const query = normalizeText(templateQuery);
    const merged = [
      ...moduleOptions.map((item) => ({ ...item, templateKind: "module" as const })),
      ...courseOptions.map((item) => ({ ...item, templateKind: "course" as const }))
    ];

    return merged
      .filter((item) => (templateKindFilter === "all" ? true : item.templateKind === templateKindFilter))
      .filter((item) => (query ? normalizeText(item.templateName).includes(query) : true))
      .sort((a, b) => a.templateName.localeCompare(b.templateName));
  }, [moduleOptions, courseOptions, templateKindFilter, templateQuery]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        const [modules, courses] = await Promise.all([
          fetchWorkoutTemplateList(userId, "module"),
          fetchWorkoutTemplateList(userId, "course")
        ]);
        setModuleOptions(modules);
        setCourseOptions(courses);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load template options.");
      } finally {
        setPrograms(readPrograms());
        setLoading(false);
      }
    };
    init();
  }, [userId]);

  useEffect(() => {
    if (droppedPulseDayIndex === null) return;
    const timer = window.setTimeout(() => {
      setDroppedPulseDayIndex(null);
    }, 520);
    return () => {
      window.clearTimeout(timer);
    };
  }, [droppedPulseDayIndex]);

  const writePrograms = (updater: (prev: WeeklyProgram[]) => WeeklyProgram[]) => {
    setPrograms((prev) => {
      const next = updater(prev).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      persistPrograms(next);
      return next;
    });
  };

  const resetEditor = () => {
    setEditingId(null);
    setProgramName("");
    setEditorWeekAnchor(toLocalDateKey(new Date()));
    setPlannerSlots(createDefaultPlannerSlots());
    setDragOverDayIndex(null);
    setDragging(null);
    setError(null);
  };

  const assignTemplate = (
    dayIndex: number,
    kind: WorkoutTemplateKind,
    templateId: number,
    fromDayIndex?: number
  ) => {
    const key = kind === "module" ? "moduleId" : "courseId";
    setPlannerSlots((prev) => {
      const next = prev.map((slot) => ({ ...slot }));
      if (typeof fromDayIndex === "number" && fromDayIndex !== dayIndex) {
        const from = next.find((slot) => slot.dayIndex === fromDayIndex);
        if (from) from[key] = null;
      }
      const target = next.find((slot) => slot.dayIndex === dayIndex);
      if (target) target[key] = templateId;
      return next;
    });
  };

  const onDropDay = (event: React.DragEvent<HTMLElement>, dayIndex: number) => {
    event.preventDefault();
    const payload = parseDragPayload(event);
    setDragOverDayIndex(null);
    setDragging(null);
    if (!payload) return;
    assignTemplate(dayIndex, payload.kind, payload.templateId, payload.fromDayIndex);
    setDroppedPulseDayIndex(dayIndex);
  };

  const updateSlot = (
    dayIndex: number,
    key: keyof Omit<PlannerDaySlot, "dayIndex">,
    value: number | string | null
  ) => {
    setPlannerSlots((prev) =>
      prev.map((slot) => (slot.dayIndex === dayIndex ? { ...slot, [key]: value } : slot))
    );
  };

  const clearDay = (dayIndex: number) => {
    setPlannerSlots((prev) =>
      prev.map((slot) =>
        slot.dayIndex === dayIndex
          ? { ...slot, moduleId: null, courseId: null, focus: "" }
          : slot
      )
    );
  };

  const clearWeek = () => {
    setPlannerSlots(createDefaultPlannerSlots());
    setEditingId(null);
    setError(null);
  };

  const handleSaveProgram = () => {
    if (!programName.trim()) {
      setError("Please enter program name.");
      return;
    }
    if (!plannerSlots.some((slot) => slot.moduleId || slot.courseId)) {
      setError("Please assign at least one training day in this plan.");
      return;
    }
    if (loadAssessment.criticalIssues.length > 0) {
      setError(`Program risk is too high: ${loadAssessment.criticalIssues.join(" | ")}.`);
      return;
    }

    setSaving(true);
    const nowIso = new Date().toISOString();
    const weekStart = parseDateOnly(editorWeekAnchor) ? editorWeekAnchor : toLocalDateKey(new Date());
    const slots = convertPlannerSlotsToProgramSlots(weekStart, plannerSlots);

    const nextProgram: WeeklyProgram = {
      id: editingId ?? `program-${Date.now()}`,
      name: programName.trim(),
      weekStart,
      slots: normalizeProgramSlots(slots),
      createdAt: editingId
        ? programs.find((item) => item.id === editingId)?.createdAt ?? nowIso
        : nowIso,
      updatedAt: nowIso
    };

    writePrograms((prev) => {
      const exists = prev.some((item) => item.id === nextProgram.id);
      return exists
        ? prev.map((item) => (item.id === nextProgram.id ? nextProgram : item))
        : [nextProgram, ...prev];
    });
    setSaving(false);
    resetEditor();
  };

  const handleEditProgram = (program: WeeklyProgram) => {
    setEditingId(program.id);
    setProgramName(program.name);
    setEditorWeekAnchor(program.weekStart);
    setPlannerSlots(convertProgramSlotsToPlannerSlots(program.weekStart, program.slots));
    setError(null);
  };

  const handleCopyProgram = (program: WeeklyProgram) => {
    setEditingId(null);
    setProgramName(`${program.name} Copy`);
    setEditorWeekAnchor(toLocalDateKey(new Date()));
    setPlannerSlots(convertProgramSlotsToPlannerSlots(program.weekStart, program.slots));
    setError(null);
  };

  const handleOpenCopyPicker = () => {
    if (programs.length === 0) {
      setError("No previous program to copy yet.");
      return;
    }
    setCopyQuery("");
    setCopyPickerOpen(true);
    setError(null);
  };

  const handleCopyAndClose = (program: WeeklyProgram) => {
    handleCopyProgram(program);
    setCopyPickerOpen(false);
    setCopyQuery("");
  };

  const handleApplyProgram = (programId: string) => {
    const startNow = toLocalDateKey(new Date());
    const nowIso = new Date().toISOString();

    writePrograms((prev) =>
      prev.map((program) => {
        if (program.id !== programId) return program;
        const planner = convertProgramSlotsToPlannerSlots(program.weekStart, program.slots);
        const remapped = convertPlannerSlotsToProgramSlots(startNow, planner);
        return {
          ...program,
          weekStart: startNow,
          slots: normalizeProgramSlots(remapped),
          updatedAt: nowIso
        };
      })
    );
  };

  const handleDeleteProgram = (programId: string) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Delete this weekly program?");
      if (!confirmed) return;
    }
    writePrograms((prev) => prev.filter((item) => item.id !== programId));
    if (editingId === programId) {
      resetEditor();
    }
  };

  const sortedPrograms = useMemo(
    () => [...programs].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [programs]
  );

  const latestProgram = sortedPrograms[0] ?? null;
  const copyPickerPrograms = useMemo(() => {
    const q = copyQuery.trim().toLowerCase();
    if (!q) return sortedPrograms;
    return sortedPrograms.filter((program) => program.name.toLowerCase().includes(q));
  }, [sortedPrograms, copyQuery]);

  const getDayLoad = (index: number): PlannerDayLoad => {
    return (
      loadAssessment.days.find((item) => item.dayIndex === index) ?? {
        dayIndex: index,
        level: "rest",
        score: 0,
        tags: [],
        hasLowerBodyFocus: false,
        hasRecoveryFocus: false,
        hasAssignment: false
      }
    );
  };

  return (
    <div className="min-h-screen bg-[#07090d] text-zinc-100">
      {copyPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0b0d11] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-white">从保存的计划复制</h3>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCopyPickerOpen(false)}
                className="h-8 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-zinc-300 hover:bg-white/10"
              >
                Close
              </Button>
            </div>

            {latestProgram ? (
              <div className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-200">最近更新</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{latestProgram.name}</p>
                    <p className="text-xs text-emerald-100/90">
                      Updated {new Date(latestProgram.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleCopyAndClose(latestProgram)}
                    className="h-8 rounded-lg bg-emerald-400 px-3 text-xs text-zinc-950 hover:bg-emerald-300"
                  >
                    使用这个
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="mt-4">
              <Input
                value={copyQuery}
                onChange={(event) => setCopyQuery(event.target.value)}
                className="h-9 border-white/10 bg-black/40 text-white"
                placeholder="搜索已保存计划名"
              />
            </div>

            <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {copyPickerPrograms.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-black/30 p-3 text-sm text-zinc-500">
                  没有匹配的已保存计划。
                </div>
              ) : (
                copyPickerPrograms.map((program) => {
                  const activeDays = convertProgramSlotsToPlannerSlots(program.weekStart, program.slots).filter(
                    (slot) => slot.moduleId || slot.courseId
                  ).length;
                  return (
                    <div
                      key={`copy-picker-${program.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{program.name}</p>
                        <p className="text-xs text-zinc-400">
                          {activeDays} active days · Updated {new Date(program.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleCopyAndClose(program)}
                        className="h-8 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-zinc-200 hover:bg-white/10"
                      >
                        Copy
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">TrainingHub</p>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">Program Planner</h1>
            <p className="text-sm text-zinc-400">
              Build a 7-day plan with Day 1 to Day 7. Drag modules/courses to each day.
            </p>
          </header>

          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg text-white">
                  {editingId ? "Edit Program" : "Create Program"}
                </CardTitle>
                <div className="flex items-center gap-2 text-zinc-400">
                  <CalendarDays className="h-4 w-4" />
                  <p className="text-xs uppercase tracking-[0.22em]">Day1-Day7 planning</p>
                </div>
              </div>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Program Name</span>
                <Input
                  value={programName}
                  onChange={(event) => setProgramName(event.target.value)}
                  className="border-white/10 bg-black/40 text-white"
                  placeholder="e.g. Week A Strength Base"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleOpenCopyPicker}
                  className="h-8 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-zinc-200 hover:bg-white/10"
                >
                  从保存的计划复制
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={clearWeek}
                  className="h-8 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-zinc-200 hover:bg-white/10"
                >
                  Clear Full Week
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Weekly Load Synthesis</p>
                  <Badge className="border-white/10 bg-zinc-800 text-zinc-200">
                    Balance {loadAssessment.balanceScore}/100
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Badge className="border-white/10 bg-zinc-800 text-zinc-300">Active {loadAssessment.activeDays}</Badge>
                  <Badge className="border-white/10 bg-zinc-800 text-zinc-300">Rest {loadAssessment.restDays}</Badge>
                  <Badge className="border-white/10 bg-zinc-800 text-zinc-300">High {loadAssessment.highDays}</Badge>
                  <Badge className="border-white/10 bg-zinc-800 text-zinc-300">Recovery {loadAssessment.recoveryDays}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1.5">
                  {plannerSlots.map((slot) => {
                    const load = getDayLoad(slot.dayIndex);
                    return (
                      <div key={`synthesis-${slot.dayIndex}`} className="space-y-1">
                        <p className="text-center text-[10px] text-zinc-500">D{slot.dayIndex + 1}</p>
                        <div className="h-1.5 rounded-full bg-white/10">
                          <div
                            className={`h-1.5 rounded-full ${loadBarClass(load.level)}`}
                            style={{ width: `${loadBarWidth(load.level, load.score)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {loadAssessment.warnings.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs text-amber-100">
                    {loadAssessment.warnings[0]}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-3 text-xs text-emerald-100">
                    Weekly distribution looks balanced for a structured cycle.
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {plannerSlots.map((slot) => {
                  const dayLabel = `Day ${slot.dayIndex + 1}`;
                  const dayLoad = getDayLoad(slot.dayIndex);
                  const isDropOver = dragOverDayIndex === slot.dayIndex;
                  const hasDropPulse = droppedPulseDayIndex === slot.dayIndex;
                  const assignedCount =
                    (slot.moduleId ? 1 : 0) + (slot.courseId ? 1 : 0);
                  return (
                    <div
                      key={slot.dayIndex}
                      className={`rounded-2xl border p-3 transition ${
                        isDropOver
                          ? "border-emerald-300/60 bg-emerald-400/10"
                          : "border-white/10 bg-black/30"
                      } ${
                        hasDropPulse
                          ? "scale-[1.01] border-emerald-300/70 shadow-[0_0_26px_rgba(78,222,163,0.28)]"
                          : ""
                      }`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverDayIndex(slot.dayIndex);
                      }}
                      onDragLeave={() => {
                        if (dragOverDayIndex === slot.dayIndex) setDragOverDayIndex(null);
                      }}
                      onDrop={(event) => onDropDay(event, slot.dayIndex)}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{dayLabel}</p>
                        <div className="flex items-center gap-1.5">
                          <Badge className="border-white/10 bg-zinc-800 text-zinc-300">
                            {assignedCount}/2
                          </Badge>
                          <Badge className={loadBadgeClass(dayLoad.level)}>{loadLabel(dayLoad.level)}</Badge>
                        </div>
                      </div>
                      <div className="mb-2 h-1.5 rounded-full bg-white/10">
                        <div
                          className={`h-1.5 rounded-full ${loadBarClass(dayLoad.level)}`}
                          style={{ width: `${loadBarWidth(dayLoad.level, dayLoad.score)}%` }}
                        />
                      </div>

                      <div className="rounded-xl border border-dashed border-white/15 bg-black/30 p-2">
                        {slot.moduleId ? (
                          <div
                            draggable
                            onDragStart={(event) => {
                              const payload: DragPayload = {
                                source: "day",
                                kind: "module",
                                templateId: slot.moduleId!,
                                fromDayIndex: slot.dayIndex
                              };
                              event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
                              setDragging(payload);
                            }}
                            onDragEnd={() => {
                              setDragging(null);
                              setDragOverDayIndex(null);
                            }}
                            className="mb-2 rounded-lg border border-sky-300/30 bg-sky-400/10 px-2 py-1.5"
                          >
                            <p className="text-[10px] uppercase tracking-[0.16em] text-sky-200">Module</p>
                            <div className="mt-1 flex items-start justify-between gap-2">
                              <p className="line-clamp-2 text-xs text-sky-100">
                                {findTemplateName(moduleOptions, slot.moduleId)}
                              </p>
                              <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-200/70" />
                            </div>
                          </div>
                        ) : null}
                        {slot.courseId ? (
                          <div
                            draggable
                            onDragStart={(event) => {
                              const payload: DragPayload = {
                                source: "day",
                                kind: "course",
                                templateId: slot.courseId!,
                                fromDayIndex: slot.dayIndex
                              };
                              event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
                              setDragging(payload);
                            }}
                            onDragEnd={() => {
                              setDragging(null);
                              setDragOverDayIndex(null);
                            }}
                            className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-2 py-1.5"
                          >
                            <p className="text-[10px] uppercase tracking-[0.16em] text-amber-100">Course</p>
                            <div className="mt-1 flex items-start justify-between gap-2">
                              <p className="line-clamp-2 text-xs text-amber-100">
                                {findTemplateName(courseOptions, slot.courseId)}
                              </p>
                              <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-100/70" />
                            </div>
                          </div>
                        ) : null}
                        {!slot.moduleId && !slot.courseId ? (
                          <p className="text-[11px] text-zinc-500">Drop module/course here</p>
                        ) : null}
                      </div>

                      <Input
                        value={slot.focus}
                        onChange={(event) => updateSlot(slot.dayIndex, "focus", event.target.value)}
                        className="mt-2 h-8 border-white/10 bg-black/45 text-xs text-zinc-200"
                        placeholder="Day focus (optional)"
                      />

                      <div className="mt-2 flex flex-wrap gap-2">
                        {slot.moduleId ? (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => updateSlot(slot.dayIndex, "moduleId", null)}
                            className="h-7 rounded-lg border border-white/10 bg-white/5 px-2 text-[11px] text-zinc-300 hover:bg-white/10"
                          >
                            Remove Module
                          </Button>
                        ) : null}
                        {slot.courseId ? (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => updateSlot(slot.dayIndex, "courseId", null)}
                            className="h-7 rounded-lg border border-white/10 bg-white/5 px-2 text-[11px] text-zinc-300 hover:bg-white/10"
                          >
                            Remove Course
                          </Button>
                        ) : null}
                        {(slot.moduleId || slot.courseId || slot.focus.trim()) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => clearDay(slot.dayIndex)}
                            className="h-7 rounded-lg border border-white/10 bg-white/5 px-2 text-[11px] text-zinc-300 hover:bg-white/10"
                          >
                            Clear Day
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {error ? (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={handleSaveProgram}
                  disabled={saving}
                  className="rounded-xl bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                >
                  {saving ? "Saving..." : editingId ? "Save Program" : "Create Program"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetEditor}
                  className="rounded-xl border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                >
                  Reset
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="rounded-xl border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                >
                  <Link to="/training">Back to Training Hub</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

        </section>

        <section className="space-y-6">
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg text-white">Template Pool</CardTitle>
                <div className="flex gap-2">
                  <Badge className="border-sky-300/30 bg-sky-400/10 text-sky-100">Modules {moduleOptions.length}</Badge>
                  <Badge className="border-amber-300/30 bg-amber-400/10 text-amber-100">Courses {courseOptions.length}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={templateQuery}
                  onChange={(event) => setTemplateQuery(event.target.value)}
                  className="h-9 max-w-sm border-white/10 bg-black/40 text-white"
                  placeholder="Search module/course"
                />
                <Button
                  type="button"
                  variant={templateKindFilter === "all" ? "default" : "ghost"}
                  onClick={() => setTemplateKindFilter("all")}
                  className={
                    templateKindFilter === "all"
                      ? "h-9 rounded-xl bg-emerald-400 text-zinc-950"
                      : "h-9 rounded-xl border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                  }
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant={templateKindFilter === "module" ? "default" : "ghost"}
                  onClick={() => setTemplateKindFilter("module")}
                  className={
                    templateKindFilter === "module"
                      ? "h-9 rounded-xl bg-emerald-400 text-zinc-950"
                      : "h-9 rounded-xl border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                  }
                >
                  Module
                </Button>
                <Button
                  type="button"
                  variant={templateKindFilter === "course" ? "default" : "ghost"}
                  onClick={() => setTemplateKindFilter("course")}
                  className={
                    templateKindFilter === "course"
                      ? "h-9 rounded-xl bg-emerald-400 text-zinc-950"
                      : "h-9 rounded-xl border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                  }
                >
                  Course
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-400">
                  Loading template pool...
                </div>
              ) : moduleOptions.length === 0 && courseOptions.length === 0 ? (
                <div className="space-y-3 rounded-xl border border-dashed border-white/10 bg-black/30 p-4 text-sm text-zinc-400">
                  <p>No module/course templates yet. Build baseline templates first, then drag them into this plan.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild type="button" variant="ghost" className="rounded-xl border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10">
                      <Link to="/modules">Create Module</Link>
                    </Button>
                    <Button asChild type="button" variant="ghost" className="rounded-xl border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10">
                      <Link to="/workout-builder">Create Course</Link>
                    </Button>
                  </div>
                </div>
              ) : templatePool.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-black/30 p-4 text-sm text-zinc-400">
                  No template matched your filter.
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {templatePool.map((template) => {
                    const isDraggingThis =
                      dragging?.source === "pool" &&
                      dragging?.kind === template.templateKind &&
                      dragging?.templateId === template.id;
                    return (
                      <button
                        key={`${template.templateKind}-${template.id}`}
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          const payload: DragPayload = {
                            source: "pool",
                            kind: template.templateKind,
                            templateId: template.id
                          };
                          event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
                          setDragging(payload);
                        }}
                        onDragEnd={() => {
                          setDragging(null);
                          setDragOverDayIndex(null);
                        }}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          isDraggingThis
                            ? "border-emerald-300/70 bg-emerald-400/10"
                            : "border-white/10 bg-black/35 hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-zinc-100">{template.templateName}</p>
                            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                              {template.templateKind}
                            </p>
                          </div>
                          <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardHeader>
              <CardTitle className="text-lg text-white">保存的周计划</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-5 text-sm text-zinc-400">
                  Loading planner options...
                </div>
              ) : sortedPrograms.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-black/30 p-5 text-sm text-zinc-500">
                  No weekly program yet.
                </div>
              ) : (
                sortedPrograms.map((program) => {
                  const plannerView = convertProgramSlotsToPlannerSlots(program.weekStart, program.slots);
                  const assessment = assessProgramLoad(plannerView, moduleNameMap, courseNameMap);
                  return (
                    <div key={program.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-2">
                          <p className="text-base font-semibold text-white">{program.name}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge className="border-white/10 bg-zinc-800 text-zinc-300">
                              {plannerView.filter((slot) => slot.moduleId || slot.courseId).length} active days
                            </Badge>
                            <Badge className="border-white/10 bg-zinc-800 text-zinc-300">
                              Balance {assessment.balanceScore}/100
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-zinc-400 hover:text-white"
                            onClick={() => handleEditProgram(program)}
                          >
                            <PencilLine className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-zinc-400 hover:text-rose-300"
                            onClick={() => handleDeleteProgram(program.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleApplyProgram(program.id)}
                          className="h-8 rounded-lg border border-emerald-300/35 bg-emerald-400/10 px-2 text-xs text-emerald-100 hover:bg-emerald-400/20"
                        >
                          <WandSparkles className="mr-1 h-3.5 w-3.5" />
                          Apply as Active (Start Today)
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleEditProgram(program)}
                          className="h-8 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-zinc-200 hover:bg-white/10"
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleCopyProgram(program)}
                          className="h-8 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-zinc-200 hover:bg-white/10"
                        >
                          Copy
                        </Button>
                      </div>

                      {assessment.warnings.length > 0 ? (
                        <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs text-amber-100">
                          {assessment.warnings[0]}
                        </div>
                      ) : null}

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {plannerView.map((slot) => {
                          const dayLoad =
                            assessment.days.find((item) => item.dayIndex === slot.dayIndex) ?? {
                              dayIndex: slot.dayIndex,
                              level: "rest" as DayLoadLevel,
                              score: 0,
                              tags: [],
                              hasLowerBodyFocus: false,
                              hasRecoveryFocus: false,
                              hasAssignment: false
                            };
                          return (
                            <div key={slot.dayIndex} className="rounded-xl border border-white/10 bg-zinc-900/60 p-3 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold uppercase tracking-[0.2em] text-zinc-500">
                                  Day {slot.dayIndex + 1}
                                </p>
                                <Badge className={loadBadgeClass(dayLoad.level)}>{loadLabel(dayLoad.level)}</Badge>
                              </div>
                              <div className="mt-1 h-1.5 rounded-full bg-white/10">
                                <div
                                  className={`h-1.5 rounded-full ${loadBarClass(dayLoad.level)}`}
                                  style={{ width: `${loadBarWidth(dayLoad.level, dayLoad.score)}%` }}
                                />
                              </div>
                              <p className="mt-1 text-zinc-300">
                                Module: {findTemplateName(moduleOptions, slot.moduleId)}
                              </p>
                              <p className="text-zinc-300">
                                Course: {findTemplateName(courseOptions, slot.courseId)}
                              </p>
                              {slot.focus ? <p className="mt-1 text-zinc-400">Focus: {slot.focus}</p> : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
