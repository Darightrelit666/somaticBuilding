import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  Activity,
  BookOpen,
  Calendar,
  CalendarDays,
  ChevronRight,
  Flame,
  ShieldAlert,
  ShieldCheck,
  Target,
  Zap
} from "lucide-react";
import { Card, CardContent } from "../../shared/components/ui/card";
import { Button } from "../../shared/components/ui/button";
import { Badge } from "../../shared/components/ui/badge";
import { fetchWorkoutTemplateList } from "../../shared/api/workout";
import { fetchTrainingHistory, type TrainingHistoryItem } from "../../shared/api/profile";
import { fetchRecommendations, type RecommendationItem } from "../../shared/api/recommendation";
import { resolveWorkoutUserId } from "./trainingHubUtils";

type ProgramDaySlot = {
  dayKey: string;
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

type ProgramDayLoad = {
  dayKey: string;
  level: DayLoadLevel;
  score: number;
  tags: string[];
};

type ProgramLoadAssessment = {
  days: ProgramDayLoad[];
  activeDays: number;
  restDays: number;
  highDays: number;
  recoveryDays: number;
  maxHighStreak: number;
  balanceScore: number;
  warnings: string[];
  suggestions: string[];
};

type RecommendedProgramCard = {
  title: string;
  level: string;
  meta: string;
  reason: string;
  href: string;
};

const STORAGE_KEY = "trainingHubWeeklyPrograms";
const DAY_COMPLETION_STORAGE_KEY = "trainingHubProgramDayCompletion";
const RISK_ACK_STORAGE_KEY = "trainingHubRiskAck";
const INCOMPLETE_REMINDER_ACK_STORAGE_KEY = "trainingHubIncompleteNudgeAck";
const WEEK_DAY_LABELS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" }
] as const;

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
  "爆发",
  "大重量",
  "高强度",
  "力量",
  "增肌",
  "冲刺",
  "体能"
];

const MODERATE_LOAD_KEYWORDS = [
  "functional",
  "athletic",
  "skill",
  "technique",
  "stability",
  "core",
  "movement",
  "function",
  "功能",
  "稳定",
  "技术",
  "控制",
  "核心"
];

const RECOVERY_KEYWORDS = [
  "mobility",
  "yoga",
  "rehab",
  "recovery",
  "corrective",
  "stretch",
  "breath",
  "flow",
  "恢复",
  "康复",
  "拉伸",
  "活动度",
  "瑜伽",
  "呼吸"
];

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const fadeUpVariant = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeText = (value: string) => value.trim().toLowerCase();

const includesAny = (source: string, keywords: string[]) =>
  keywords.some((keyword) => source.includes(keyword));

const toLocalDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatShortDate = (raw: string) => {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit"
  });
};

const formatRunDuration = (item: TrainingHistoryItem) => {
  const start = new Date(item.startTime);
  const end = new Date(item.endTime);
  if (Number.isNaN(start.getTime())) return "N/A";
  if (Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) return "In progress";
  const minutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  return `${minutes} min`;
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

const readPrograms = (): WeeklyProgram[] => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
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

const isDateInProgramWeek = (date: Date, weekStart: string) => {
  const start = parseDateOnly(weekStart);
  if (!start) return false;
  const end = addDays(start, 6);
  const dateOnly = parseDateOnly(toLocalDateKey(date));
  if (!dateOnly) return false;
  return dateOnly >= start && dateOnly <= end;
};

const selectActiveProgram = (programs: WeeklyProgram[], date: Date) => {
  const inRange = programs.filter((program) => isDateInProgramWeek(date, program.weekStart));
  const sortByUpdated = (a: WeeklyProgram, b: WeeklyProgram) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  if (inRange.length > 0) {
    return [...inRange].sort(sortByUpdated)[0];
  }
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

const getDayLabel = (dayKey: string) =>
  WEEK_DAY_LABELS.find((item) => item.key === dayKey)?.label ?? dayKey;

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

const assessWeeklyProgram = (
  program: WeeklyProgram | null,
  moduleNameMap: Map<number, string>,
  courseNameMap: Map<number, string>
): ProgramLoadAssessment => {
  const emptyDays: ProgramDayLoad[] = WEEK_DAY_LABELS.map((day) => ({
    dayKey: day.key,
    level: "rest",
    score: 0,
    tags: []
  }));

  if (!program) {
    return {
      days: emptyDays,
      activeDays: 0,
      restDays: 7,
      highDays: 0,
      recoveryDays: 0,
      maxHighStreak: 0,
      balanceScore: 0,
      warnings: ["No active weekly program detected."],
      suggestions: ["Open Program Planner and assign at least 3 active days."]
    };
  }

  const dayLoads: ProgramDayLoad[] = WEEK_DAY_LABELS.map((day) => {
    const slot = program.slots.find((item) => item.dayKey === day.key);
    if (!slot) {
      return {
        dayKey: day.key,
        level: "rest",
        score: 0,
        tags: []
      };
    }

    const moduleName = slot.moduleId ? moduleNameMap.get(slot.moduleId) ?? "" : "";
    const courseName = slot.courseId ? courseNameMap.get(slot.courseId) ?? "" : "";
    const focus = slot.focus ?? "";
    const merged = normalizeText(`${moduleName} ${courseName} ${focus}`);
    const hasAssignment = Boolean(slot.moduleId || slot.courseId || focus.trim());

    if (!hasAssignment) {
      return {
        dayKey: day.key,
        level: "rest",
        score: 0,
        tags: []
      };
    }

    let score = 0;
    if (slot.moduleId) score += 2;
    if (slot.courseId) score += 3;
    if (slot.moduleId && slot.courseId) score += 1;

    const hasHigh = includesAny(merged, HIGH_LOAD_KEYWORDS);
    const hasModerate = includesAny(merged, MODERATE_LOAD_KEYWORDS);
    const hasRecovery = includesAny(merged, RECOVERY_KEYWORDS);

    if (hasHigh) score += 3;
    if (hasModerate) score += 1;
    if (hasRecovery) score -= 2;

    score = clamp(score, 0, 10);

    const level: DayLoadLevel =
      score === 0 ? "rest" : score <= 2 ? "low" : score <= 5 ? "moderate" : "high";

    const tags: string[] = [];
    if (slot.moduleId && slot.courseId) tags.push("Dual load");
    if (hasHigh) tags.push("High intent");
    if (hasModerate) tags.push("Skill/functional");
    if (hasRecovery) tags.push("Recovery");

    return {
      dayKey: day.key,
      level,
      score,
      tags
    };
  });

  const activeDays = dayLoads.filter((item) => item.level !== "rest").length;
  const restDays = dayLoads.filter((item) => item.level === "rest").length;
  const highDays = dayLoads.filter((item) => item.level === "high").length;
  const recoveryDays = dayLoads.filter((item) => item.tags.includes("Recovery") || item.level === "low").length;

  let highStreak = 0;
  let maxHighStreak = 0;
  for (const dayLoad of dayLoads) {
    if (dayLoad.level === "high") {
      highStreak += 1;
      maxHighStreak = Math.max(maxHighStreak, highStreak);
    } else {
      highStreak = 0;
    }
  }

  const warnings: string[] = [];
  if (restDays === 0) warnings.push("No rest day in this weekly plan.");
  if (maxHighStreak >= 3) warnings.push(`High-intensity streak: ${maxHighStreak} days.`);
  if (highDays >= 4) warnings.push("Too many high-intensity days this week.");
  if (recoveryDays === 0) warnings.push("No recovery-oriented day scheduled.");

  const suggestions: string[] = [];
  if (restDays === 0) suggestions.push("Add one full rest day.");
  if (maxHighStreak >= 3) suggestions.push("Insert a low/recovery day between high-intensity days.");
  if (recoveryDays === 0) suggestions.push("Add one mobility/rehab/flow day.");
  if (activeDays < 3) suggestions.push("Increase active training days to at least 3.");

  let balanceScore = 100;
  if (restDays === 0) balanceScore -= 20;
  if (highDays > 3) balanceScore -= (highDays - 3) * 8;
  if (maxHighStreak >= 3) balanceScore -= 12 + (maxHighStreak - 3) * 6;
  if (recoveryDays === 0) balanceScore -= 10;
  if (activeDays < 3) balanceScore -= 12;
  balanceScore = clamp(balanceScore, 0, 100);

  return {
    days: dayLoads,
    activeDays,
    restDays,
    highDays,
    recoveryDays,
    maxHighStreak,
    balanceScore,
    warnings,
    suggestions
  };
};

const resolveTemplateName = (
  id: number | null,
  map: Map<number, string>,
  prefix: string
) => {
  if (!id) return "Not set";
  return map.get(id) ?? `${prefix} #${id}`;
};

const buildRecommendationCards = (
  recommendations: RecommendationItem[],
  loadAssessment: ProgramLoadAssessment,
  activeProgram: WeeklyProgram | null,
  moduleNameMap: Map<number, string>,
  courseNameMap: Map<number, string>
): RecommendedProgramCard[] => {
  const backendCards = recommendations.slice(0, 3).map((item) => {
    const type = item.recType.trim().toLowerCase();
    const isModule = type.includes("module");
    const isCourse = type.includes("course");
    const isProgram = type.includes("program");
    const templateName = isModule
      ? moduleNameMap.get(item.refId)
      : isCourse
        ? courseNameMap.get(item.refId)
        : "";

    return {
      title:
        templateName ||
        (isModule
          ? `Module #${item.refId}`
          : isCourse
            ? `Course #${item.refId}`
            : isProgram
              ? `Program #${item.refId}`
              : item.reason || "Backend recommendation"),
      level: isModule ? "Module" : isCourse ? "Course" : isProgram ? "Program" : "Recommendation",
      meta: item.reason || "Synced from recommendation service",
      reason: item.reason || "Synced from recommendation service",
      href: isModule && item.refId > 0 ? `/module/${item.refId}` : isProgram ? "/programs" : "/templates"
    };
  });

  if (backendCards.length > 0) return backendCards;
  if (!activeProgram || loadAssessment.suggestions.length === 0) return [];

  return loadAssessment.suggestions.slice(0, 3).map((suggestion, index) => ({
    title: index === 0 ? "Adjust weekly load" : "Program balance check",
    level: "Program",
    meta: activeProgram.name,
    reason: suggestion,
    href: "/programs"
  }));
};

const summarizeLoggedRunsForWindow = (
  history: TrainingHistoryItem[],
  activeProgram: WeeklyProgram | null,
  now: Date
) => {
  const fallbackStart = addDays(now, -6);
  const start = activeProgram ? parseDateOnly(activeProgram.weekStart) ?? fallbackStart : fallbackStart;
  const end = addDays(start, 6);
  const activeDays = new Set<string>();
  let loggedMinutes = 0;
  let completedRuns = 0;

  history.forEach((item) => {
    const startedAt = new Date(item.startTime);
    if (Number.isNaN(startedAt.getTime())) return;
    const startedDate = parseDateOnly(toLocalDateKey(startedAt));
    if (!startedDate || startedDate < start || startedDate > end) return;

    completedRuns += 1;
    activeDays.add(toLocalDateKey(startedAt));

    const endedAt = new Date(item.endTime);
    if (!Number.isNaN(endedAt.getTime()) && endedAt.getTime() > startedAt.getTime()) {
      loggedMinutes += Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
    }
  });

  return {
    completedRuns,
    loggedActiveDays: activeDays.size,
    loggedMinutes
  };
};

export function WorkoutSetupPage() {
  const navigate = useNavigate();
  const userId = useMemo(() => resolveWorkoutUserId(), []);
  const [weeklyPrograms, setWeeklyPrograms] = useState<WeeklyProgram[]>([]);
  const [moduleNameMap, setModuleNameMap] = useState<Map<number, string>>(new Map());
  const [courseNameMap, setCourseNameMap] = useState<Map<number, string>>(new Map());
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [trainingHistory, setTrainingHistory] = useState<TrainingHistoryItem[]>([]);
  const [hubDataError, setHubDataError] = useState<string | null>(null);
  const [completionMap, setCompletionMap] = useState<Record<string, string>>({});
  const [riskAckMap, setRiskAckMap] = useState<Record<string, string>>({});
  const [incompleteAckMap, setIncompleteAckMap] = useState<Record<string, string>>({});
  const [riskModalOpen, setRiskModalOpen] = useState(false);
  const [incompleteReminderOpen, setIncompleteReminderOpen] = useState(false);
  const [clockTick, setClockTick] = useState(() => Date.now());

  useEffect(() => {
    const refreshPrograms = () => {
      setWeeklyPrograms(readPrograms());
    };

    refreshPrograms();
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === STORAGE_KEY) {
        refreshPrograms();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", refreshPrograms);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", refreshPrograms);
    };
  }, []);

  useEffect(() => {
    setCompletionMap(readStringRecord(DAY_COMPLETION_STORAGE_KEY));
    setRiskAckMap(readStringRecord(RISK_ACK_STORAGE_KEY));
    setIncompleteAckMap(readStringRecord(INCOMPLETE_REMINDER_ACK_STORAGE_KEY));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick(Date.now());
    }, 60_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadTemplateNames = async () => {
      try {
        const [modules, courses] = await Promise.all([
          fetchWorkoutTemplateList(userId, "module"),
          fetchWorkoutTemplateList(userId, "course")
        ]);
        if (cancelled) return;

        setModuleNameMap(new Map(modules.map((item) => [item.id, item.templateName])));
        setCourseNameMap(new Map(courses.map((item) => [item.id, item.templateName])));
      } catch {
        if (!cancelled) {
          setModuleNameMap(new Map());
          setCourseNameMap(new Map());
        }
      }
    };

    loadTemplateNames();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const loadHubData = async () => {
      setHubDataError(null);
      const [recommendationResult, trainingResult] = await Promise.allSettled([
        fetchRecommendations(userId),
        fetchTrainingHistory(userId, 20)
      ]);
      if (cancelled) return;

      if (recommendationResult.status === "fulfilled") {
        setRecommendations(recommendationResult.value);
      } else {
        setRecommendations([]);
      }

      if (trainingResult.status === "fulfilled") {
        setTrainingHistory(trainingResult.value);
      } else {
        setTrainingHistory([]);
      }

      const failures = [recommendationResult, trainingResult]
        .filter((result) => result.status === "rejected")
        .map((result) =>
          result.status === "rejected" && result.reason instanceof Error
            ? result.reason.message
            : "Hub data request failed."
        );
      setHubDataError(failures[0] ?? null);
    };

    void loadHubData();
    window.addEventListener("focus", loadHubData);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", loadHubData);
    };
  }, [userId]);

  const activeProgram = useMemo(
    () => selectActiveProgram(weeklyPrograms, new Date(clockTick)),
    [weeklyPrograms, clockTick]
  );

  const todayKey = useMemo(() => getDayKeyFromDate(new Date(clockTick)), [clockTick]);

  const todaySlot = useMemo(() => {
    if (!activeProgram) return null;
    return activeProgram.slots.find((slot) => slot.dayKey === todayKey) ?? null;
  }, [activeProgram, todayKey]);

  const loadAssessment = useMemo(
    () => assessWeeklyProgram(activeProgram, moduleNameMap, courseNameMap),
    [activeProgram, moduleNameMap, courseNameMap]
  );

  const loggedRunSummary = useMemo(
    () => summarizeLoggedRunsForWindow(trainingHistory, activeProgram, new Date(clockTick)),
    [activeProgram, clockTick, trainingHistory]
  );

  const recommendationCards = useMemo(
    () =>
      buildRecommendationCards(
        recommendations,
        loadAssessment,
        activeProgram,
        moduleNameMap,
        courseNameMap
      ),
    [activeProgram, courseNameMap, loadAssessment, moduleNameMap, recommendations]
  );

  const recentRunCards = useMemo(
    () =>
      trainingHistory
        .slice()
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 5),
    [trainingHistory]
  );

  const todayLoad =
    loadAssessment.days.find((day) => day.dayKey === todayKey) ??
    ({ dayKey: todayKey, level: "rest", score: 0, tags: [] } as ProgramDayLoad);

  const todayModuleName = resolveTemplateName(todaySlot?.moduleId ?? null, moduleNameMap, "Module");
  const todayCourseName = resolveTemplateName(todaySlot?.courseId ?? null, courseNameMap, "Course");
  const todayPlanDetails = [
    todayModuleName !== "Not set" ? `Module ${todayModuleName}` : "",
    todayCourseName !== "Not set" ? `Course ${todayCourseName}` : "",
    todaySlot?.focus?.trim() ? `Focus ${todaySlot.focus.trim()}` : ""
  ].filter(Boolean);

  const todayLabel = getDayLabel(todayKey);
  const currentDate = useMemo(() => new Date(clockTick), [clockTick]);
  const currentHour = currentDate.getHours();
  const todayDateKey = useMemo(() => toLocalDateKey(currentDate), [currentDate]);
  const todayCompletionKey = activeProgram
    ? `${activeProgram.id}:${activeProgram.weekStart}:${todayKey}`
    : "";
  const todayDone = todayCompletionKey
    ? (completionMap[todayCompletionKey] ?? "").startsWith("done:")
    : false;

  const planStatus = !activeProgram
    ? { label: "No Program", className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300" }
    : loadAssessment.balanceScore >= 75
    ? { label: "Balanced", className: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" }
    : loadAssessment.balanceScore >= 50
    ? { label: "Watch", className: "border-amber-300/30 bg-amber-400/10 text-amber-100" }
    : { label: "Risk", className: "border-rose-400/30 bg-rose-500/10 text-rose-200" };

  const todayHighRisk =
    Boolean(activeProgram) &&
    (loadAssessment.balanceScore < 50 ||
      (todayLoad.level === "high" && loadAssessment.maxHighStreak >= 2) ||
      loadAssessment.highDays >= 4);

  const riskAckKey = activeProgram ? `${activeProgram.id}:${todayDateKey}` : "";
  const riskAlreadyAcknowledged = riskAckKey ? riskAckMap[riskAckKey] === "ack" : false;
  const incompleteReminderAckKey = activeProgram ? `${activeProgram.id}:${todayDateKey}` : "";
  const incompleteReminderAcknowledged = incompleteReminderAckKey
    ? incompleteAckMap[incompleteReminderAckKey] === "ack"
    : false;
  const todayHasPlannedTraining = Boolean(
    todaySlot && (todaySlot.moduleId || todaySlot.courseId || todaySlot.focus.trim())
  );

  const startTodayCourse = () => {
    if (!todaySlot?.courseId) return;
    window.localStorage.setItem("workoutApplyTemplateBackendId", String(todaySlot.courseId));
    navigate("/workout-builder");
  };

  const startTodayModule = () => {
    if (!todaySlot?.moduleId) return;
    navigate(`/module/${todaySlot.moduleId}`);
  };

  const markRiskAcknowledged = () => {
    if (!riskAckKey) {
      setRiskModalOpen(false);
      return;
    }
    const next = { ...riskAckMap, [riskAckKey]: "ack" };
    setRiskAckMap(next);
    writeStringRecord(RISK_ACK_STORAGE_KEY, next);
    setRiskModalOpen(false);
  };

  const dismissIncompleteReminder = () => {
    if (!incompleteReminderAckKey) {
      setIncompleteReminderOpen(false);
      return;
    }
    const next = { ...incompleteAckMap, [incompleteReminderAckKey]: "ack" };
    setIncompleteAckMap(next);
    writeStringRecord(INCOMPLETE_REMINDER_ACK_STORAGE_KEY, next);
    setIncompleteReminderOpen(false);
  };

  const toggleTodayCompletion = () => {
    if (!todayCompletionKey) return;
    const next = { ...completionMap };
    if (todayDone) {
      delete next[todayCompletionKey];
    } else {
      next[todayCompletionKey] = `done:${new Date().toISOString()}`;
    }
    setCompletionMap(next);
    writeStringRecord(DAY_COMPLETION_STORAGE_KEY, next);
  };

  useEffect(() => {
    if (!todayHighRisk || riskAlreadyAcknowledged || !activeProgram || todayDone) {
      setRiskModalOpen(false);
      return;
    }
    setRiskModalOpen(true);
  }, [todayHighRisk, riskAlreadyAcknowledged, activeProgram, todayDone]);

  useEffect(() => {
    const shouldShow =
      Boolean(activeProgram) &&
      todayHasPlannedTraining &&
      !todayDone &&
      currentHour >= 19 &&
      !todayHighRisk &&
      !riskModalOpen &&
      !incompleteReminderAcknowledged;
    setIncompleteReminderOpen(shouldShow);
  }, [
    activeProgram,
    todayHasPlannedTraining,
    todayDone,
    currentHour,
    todayHighRisk,
    riskModalOpen,
    incompleteReminderAcknowledged
  ]);

  return (
    <div className="min-h-screen bg-[#07090d] text-zinc-100 selection:bg-emerald-500/30">
      {riskModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-300/30 bg-[#0b0d11] p-5 shadow-[0_30px_60px_rgba(0,0,0,0.55)]">
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-300" />
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">
                Training Risk Alert
              </p>
            </div>
            <p className="text-sm text-zinc-200">
              Today's load is elevated based on your weekly schedule. Prioritize movement quality and keep intensity conservative if form degrades.
            </p>
            {loadAssessment.warnings.length > 0 ? (
              <p className="mt-2 text-xs text-amber-100">{loadAssessment.warnings[0]}</p>
            ) : null}
            {loadAssessment.suggestions.length > 0 ? (
              <p className="mt-2 text-xs text-zinc-400">Suggestion: {loadAssessment.suggestions[0]}</p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                onClick={markRiskAcknowledged}
                className="flex-1 rounded-xl bg-amber-300 text-zinc-950 hover:bg-amber-200"
              >
                I Understand
              </Button>
              <Button
                asChild
                variant="ghost"
                className="rounded-xl border border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
              >
                <Link to="/programs">Adjust Plan</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {incompleteReminderOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-md rounded-2xl border border-sky-300/30 bg-[#0b0d11] p-5 shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-sky-300" />
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-200">
                Evening Check-In
              </p>
            </div>
            <p className="text-sm text-zinc-200">
              You still have a scheduled training for today. If energy and recovery allow, complete a focused session to keep your weekly rhythm.
            </p>
            <div className="mt-2 text-xs text-zinc-400">
              Today: {todayLabel}
              {todayPlanDetails.length > 0 ? ` · ${todayPlanDetails.join(" · ")}` : ""}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {todaySlot?.moduleId ? (
                <Button
                  type="button"
                  onClick={() => {
                    dismissIncompleteReminder();
                    startTodayModule();
                  }}
                  className="rounded-xl bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                >
                  Start Module
                </Button>
              ) : null}
              {todaySlot?.courseId ? (
                <Button
                  type="button"
                  onClick={() => {
                    dismissIncompleteReminder();
                    startTodayCourse();
                  }}
                  className="rounded-xl border border-white/15 bg-zinc-900/70 text-zinc-100 hover:bg-zinc-800"
                >
                  Start Course
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                onClick={dismissIncompleteReminder}
                className="rounded-xl border border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
              >
                Remind Tomorrow
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="relative min-h-screen overflow-hidden">
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.05, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(78,222,163,0.12),_transparent_70%)] blur-3xl"
        />
        <motion.div
          animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.1, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="pointer-events-none absolute right-[-10%] top-[20%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,_rgba(78,222,163,0.1),_transparent_70%)] blur-3xl"
        />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16"
        >
          <motion.header variants={fadeUpVariant} className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-400/80">
                Somatic Building
              </p>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Training Hub
            </h1>
            <p className="max-w-2xl text-base text-zinc-400">
              Start your training with module, course, and weekly program workflows.
            </p>
          </motion.header>

          <motion.section variants={fadeUpVariant} className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="rounded-[1.75rem] border-emerald-400/20 bg-emerald-500/[0.06]">
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-emerald-300" />
                    <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/80">
                      Today Program Radar
                    </p>
                  </div>
                  <Badge className={planStatus.className}>{planStatus.label}</Badge>
                </div>

                {activeProgram ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge className="border-white/10 bg-zinc-800 text-zinc-200">
                        {activeProgram.name}
                      </Badge>
                      <Badge className="border-white/10 bg-zinc-800 text-zinc-300">
                        Week of {activeProgram.weekStart}
                      </Badge>
                      <Badge className="border-white/10 bg-zinc-800 text-zinc-300">
                        Balance {loadAssessment.balanceScore}/100
                      </Badge>
                      <Badge
                        className={
                          todayDone
                            ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                            : "border-white/10 bg-zinc-800 text-zinc-300"
                        }
                      >
                        {todayDone ? "Today: Done" : "Today: Scheduled"}
                      </Badge>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{todayLabel}</p>
                        <Badge className={loadBadgeClass(todayLoad.level)}>{loadLabel(todayLoad.level)}</Badge>
                      </div>
                      <p className="text-sm text-zinc-300">Module: {todayModuleName}</p>
                      <p className="text-sm text-zinc-300">Course: {todayCourseName}</p>
                      {todaySlot?.focus ? (
                        <p className="mt-1 text-sm text-zinc-400">Focus: {todaySlot.focus}</p>
                      ) : null}
                      {todayLoad.tags.length > 0 ? (
                        <p className="mt-1 text-xs text-zinc-500">{todayLoad.tags.join(" 路 ")}</p>
                      ) : null}
                    </div>

                    {loadAssessment.warnings.length > 0 ? (
                      <div className="rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-xs text-amber-100">
                        {loadAssessment.warnings[0]}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-3 text-xs text-emerald-100">
                        Weekly load distribution is currently stable.
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {todaySlot?.moduleId ? (
                        <Button
                          type="button"
                          onClick={startTodayModule}
                          className="rounded-xl bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                        >
                          Start Module
                        </Button>
                      ) : null}
                      {todaySlot?.courseId ? (
                        <Button
                          type="button"
                          onClick={startTodayCourse}
                          className="rounded-xl border border-white/15 bg-zinc-900/70 text-zinc-100 hover:bg-zinc-800"
                        >
                          Start Course
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        onClick={toggleTodayCompletion}
                        variant="ghost"
                        className="rounded-xl border border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
                      >
                        {todayDone ? "Undo Done" : "Mark Done"}
                      </Button>
                      <Button
                        asChild
                        variant="ghost"
                        className="rounded-xl border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
                      >
                        <Link to="/programs">Open Program Planner</Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 rounded-2xl border border-dashed border-white/15 bg-black/30 p-5">
                    <p className="text-sm text-zinc-300">
                      No active weekly program. You can still train single sessions, but setting a weekly structure helps with recovery and progression.
                    </p>
                    <Button
                      asChild
                      className="rounded-xl bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                    >
                      <Link to="/programs">Create Weekly Program</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-white/10 bg-white/[0.03]">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-2">
                  {loadAssessment.balanceScore >= 65 ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-amber-200" />
                  )}
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Weekly Snapshot</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-zinc-500">Planned Days</p>
                    <p className="mt-1 text-lg font-semibold text-white">{loadAssessment.activeDays}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-zinc-500">Logged Runs</p>
                    <p className="mt-1 text-lg font-semibold text-white">{loggedRunSummary.completedRuns}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-zinc-500">Logged Min</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-lg font-semibold text-white">
                      <Flame className="h-4 w-4 text-rose-300" />
                      {loggedRunSummary.loggedMinutes}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-zinc-500">Balance</p>
                    <p className="mt-1 text-lg font-semibold text-white">{loadAssessment.balanceScore}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-300">
                  Logged active days this window:{" "}
                  <span className="font-semibold text-white">{loggedRunSummary.loggedActiveDays}</span>
                  <span className="mx-2 text-zinc-600">/</span>
                  max high-intensity streak:{" "}
                  <span className="font-semibold text-white">{loadAssessment.maxHighStreak}</span>
                </div>
                {trainingHistory.length === 0 ? (
                  <p className="text-xs text-amber-100/80">
                    No completed backend training runs yet. Weekly log metrics will become meaningful after you finish sessions.
                  </p>
                ) : null}
                {loadAssessment.suggestions.length > 0 ? (
                  <p className="text-xs text-zinc-400">Tip: {loadAssessment.suggestions[0]}</p>
                ) : null}
              </CardContent>
            </Card>
          </motion.section>

          <motion.section variants={fadeUpVariant} className="grid gap-6 lg:grid-cols-3">
            <motion.div whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300 }}>
              <Card className="group relative overflow-hidden rounded-[2rem] border-white/5 bg-white/[0.02] shadow-2xl backdrop-blur-xl transition-colors hover:border-emerald-500/20 hover:bg-white/[0.04]">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <CardContent className="relative flex h-full min-h-[280px] flex-col gap-6 p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-400 ring-1 ring-emerald-400/20">
                      <Activity className="h-7 w-7" />
                    </div>
                    <Badge className="border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20">
                      Module Hub
                    </Badge>
                  </div>
                  <div className="mt-auto space-y-2">
                    <h2 className="text-3xl font-semibold text-white">Quick Module</h2>
                    <p className="text-sm text-zinc-400">
                      Build short modules and launch them directly.
                    </p>
                  </div>
                  <Button
                    asChild
                    className="w-full rounded-2xl bg-emerald-400 py-6 text-base font-semibold text-zinc-950 shadow-[0_0_20px_rgba(78,222,163,0.3)] transition-all hover:bg-emerald-300 hover:shadow-[0_0_30px_rgba(78,222,163,0.5)]"
                  >
                    <Link to="/modules">Open Module Hub</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300 }}>
              <Card className="group relative overflow-hidden rounded-[2rem] border-white/5 bg-white/[0.02] shadow-2xl backdrop-blur-xl transition-colors hover:border-emerald-500/20 hover:bg-white/[0.04]">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <CardContent className="relative flex h-full min-h-[280px] flex-col gap-6 p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-400 ring-1 ring-emerald-400/20">
                      <BookOpen className="h-7 w-7" />
                    </div>
                    <Badge className="border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20">
                      Course Hub
                    </Badge>
                  </div>
                  <div className="mt-auto space-y-2">
                    <h2 className="text-3xl font-semibold text-white">Training Course</h2>
                    <p className="text-sm text-zinc-400">
                      Design and manage reusable training course templates.
                    </p>
                  </div>
                  <Button
                    asChild
                    className="w-full rounded-2xl border border-white/10 bg-zinc-900/80 py-6 text-base font-semibold text-zinc-200 transition-all hover:bg-zinc-800 hover:text-white"
                  >
                    <Link to="/templates">Open Course Hub</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300 }}>
              <Card className="group relative overflow-hidden rounded-[2rem] border-white/5 bg-white/[0.02] shadow-2xl backdrop-blur-xl transition-colors hover:border-emerald-500/20 hover:bg-white/[0.04]">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <CardContent className="relative flex h-full min-h-[280px] flex-col gap-6 p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-400 ring-1 ring-emerald-400/20">
                      <CalendarDays className="h-7 w-7" />
                    </div>
                    <Badge className="border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20">
                      Weekly Plan
                    </Badge>
                  </div>
                  <div className="mt-auto space-y-2">
                    <h2 className="text-3xl font-semibold text-white">Program</h2>
                    <p className="text-sm text-zinc-400">
                      Create one-week program plans using modules and courses.
                    </p>
                  </div>
                  <Button
                    asChild
                    className="w-full rounded-2xl border border-white/10 bg-zinc-900/80 py-6 text-base font-semibold text-zinc-200 transition-all hover:bg-zinc-800 hover:text-white"
                  >
                    <Link to="/programs">Open Program Planner</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </motion.section>

          <div className="mt-4 grid gap-10 lg:grid-cols-2">
            <motion.section variants={fadeUpVariant} className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">Recommended</h3>
                <Button
                  variant="link"
                  className="flex h-auto items-center gap-1 p-0 font-medium text-zinc-400 hover:text-emerald-400"
                >
                  Explore <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-4">
                {recommendationCards.length > 0 ? (
                  recommendationCards.map((program) => (
                    <motion.div
                      key={`${program.level}-${program.title}-${program.reason}`}
                      whileHover={{ scale: 1.01, x: 4 }}
                      className="group flex cursor-pointer items-center justify-between rounded-2xl border border-white/5 bg-white/[0.01] p-5 shadow-lg backdrop-blur transition-colors hover:bg-white/[0.03]"
                    >
                      <Link to={program.href} className="flex flex-1 items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <p className="font-semibold text-white transition-colors group-hover:text-emerald-300">
                            {program.title}
                          </p>
                          <p className="text-xs font-medium text-zinc-500">
                            {program.meta}
                          </p>
                        </div>
                        <Badge className="border-white/5 bg-zinc-800/80 font-normal text-zinc-300">
                          {program.level}
                        </Badge>
                      </Link>
                    </motion.div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-5 text-sm text-zinc-400">
                    No backend recommendations yet. Complete assessments, save plans, and finish sessions to unlock data-driven suggestions.
                  </div>
                )}
              </div>
            </motion.section>

            <motion.section variants={fadeUpVariant} className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">Recent Log</h3>
                <Button
                  variant="link"
                  className="flex h-auto items-center gap-1 p-0 font-medium text-zinc-400 hover:text-emerald-400"
                >
                  View all <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-4">
                {recentRunCards.length > 0 ? (
                  recentRunCards.map((workout) => (
                    <motion.div
                      key={workout.runId}
                      whileHover={{ scale: 1.01, x: 4 }}
                      className="group flex cursor-pointer items-center justify-between rounded-2xl border border-white/5 bg-white/[0.01] p-5 shadow-lg backdrop-blur transition-colors hover:bg-white/[0.03]"
                    >
                      <Link to="/profile" className="flex flex-1 items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <p className="font-semibold text-white transition-colors group-hover:text-emerald-300">
                            Training Run #{workout.runId}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{formatShortDate(workout.startTime)}</span>
                            <span className="opacity-50">·</span>
                            <span>{formatRunDuration(workout)}</span>
                            <span className="opacity-50">·</span>
                            <span>Session {workout.sessionId}</span>
                          </div>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-zinc-800/80">
                          <ChevronRight className="h-4 w-4 text-zinc-400 transition-colors group-hover:text-white" />
                        </div>
                      </Link>
                    </motion.div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-5 text-sm text-zinc-400">
                    No backend training logs yet. Finish a module or course run and this list will update from training-service history.
                  </div>
                )}
                {hubDataError ? (
                  <p className="text-xs text-amber-200/80">Data source warning: {hubDataError}</p>
                ) : null}
              </div>
            </motion.section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
