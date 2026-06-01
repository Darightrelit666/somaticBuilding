import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { History, Zap } from "lucide-react";
import {
  checkDisplayNameAvailability,
  fetchAbilityHistory,
  fetchAbilityProfileLatest,
  fetchTrainingHistory,
  fetchUserProfile,
  updateUserProfile,
  type AbilityHistoryData,
  type AbilityProfileData,
  type TrainingHistoryItem,
  type UserProfileData
} from "../../shared/api/profile";
import {
  AUTH_DISPLAY_NAME_STORAGE_KEY,
  emitAuthStateChanged
} from "../../shared/api/auth";
import {
  ABILITY_METRIC_LABELS,
  ABILITY_METRIC_ORDER,
  AbilityTrendMultiLineChart,
  DualRadarChart,
  ReadinessOrbPanel,
  TrainingCalendarHeatmap,
  type AbilityMetricKey,
  type AbilityTrendPoint
} from "./ProfileVisualizations";

const DEFAULT_USER_ID = 1;
const SYSTEM_GOAL_SYNTHESIS_KEY = "systemGoalSynthesis";

const defaultAbilityStats: AbilityProfileData = {
  strength: 65,
  power: 60,
  endurance: 62,
  mobility: 64,
  stability: 63,
  speed: 58
};

const DUPLICATE_NICKNAME_MESSAGE = "Nickname already exists. Please try another one.";

const resolveProfileUserId = () => {
  if (typeof window === "undefined") return DEFAULT_USER_ID;
  const raw =
    window.localStorage.getItem("workoutActiveUserId") ||
    window.localStorage.getItem("userId");
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USER_ID;
};

type OnboardingDraft = {
  age?: number | string;
  heightCm?: number | string;
  weightKg?: number | string;
  trainingYears?: number | string;
  gender?: string | number;
  primaryDiscipline?: string;
  movementInjuryHistory?: string;
  weeklyRoutine?: string;
  selfLevel?: string;
};

const readOnboardingDraft = (): OnboardingDraft | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("systemOnboardingDraft");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as OnboardingDraft;
  } catch {
    return null;
  }
};

const toPositiveNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
};

const parseDraftGender = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value === 1 || value === 2) return value;
    return 0;
  }
  if (typeof value !== "string") return 0;
  const normalized = value.trim().toLowerCase();
  if (normalized === "male") return 1;
  if (normalized === "female") return 2;
  return 0;
};

const clampStat = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const mapGoalRadarToAbilityStats = (radar: unknown): AbilityProfileData | null => {
  if (!Array.isArray(radar)) return null;
  const scoreBySubject = new Map<string, number>();
  for (const item of radar) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const rawSubject = typeof record.subject === "string" ? record.subject : "";
    const rawScore = typeof record.score === "number" ? record.score : Number.NaN;
    if (!rawSubject || !Number.isFinite(rawScore)) continue;
    scoreBySubject.set(rawSubject.trim().toLowerCase(), clampStat(rawScore));
  }

  if (scoreBySubject.size === 0) return null;

  const mobility = scoreBySubject.get("mobility");
  const stability = scoreBySubject.get("stability");
  const strength = scoreBySubject.get("strength");
  const power = scoreBySubject.get("power");
  const endurance = scoreBySubject.get("endurance");
  const control = scoreBySubject.get("control");

  const fallback = 60;
  const speedFromControl =
    typeof control === "number" ? control : Math.round(((power ?? fallback) + (mobility ?? fallback)) / 2);

  return {
    mobility: clampStat(mobility ?? fallback),
    stability: clampStat(stability ?? fallback),
    strength: clampStat(strength ?? fallback),
    power: clampStat(power ?? fallback),
    endurance: clampStat(endurance ?? fallback),
    speed: clampStat(speedFromControl)
  };
};

const readGoalAbilityTarget = (): AbilityProfileData | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SYSTEM_GOAL_SYNTHESIS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const root = parsed as Record<string, unknown>;
    const synthesis = root.synthesis;
    if (typeof synthesis !== "object" || synthesis === null) return null;
    const radar = (synthesis as Record<string, unknown>).radar;
    return mapGoalRadarToAbilityStats(radar);
  } catch {
    return null;
  }
};

const formatShortDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
};

const formatDuration = (startTime: string, endTime: string) => {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "N/A";
  const seconds = Math.floor((end - start) / 1000);
  const minutesPart = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secondsPart = (seconds % 60).toString().padStart(2, "0");
  return `${minutesPart}:${secondsPart}`;
};

const formatLocalDayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const genderLabel = (gender: number) => {
  if (gender === 1) return "Male";
  if (gender === 2) return "Female";
  return "Unspecified";
};

const buildPrivateLifestyleSummary = (rawNote: string) => {
  const source = rawNote.trim();
  if (!source) return "";

  const entries = source
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  const detailMap = new Map<string, string>();
  for (const entry of entries) {
    const splitIndex = entry.indexOf(":");
    if (splitIndex <= 0) continue;
    const key = entry.slice(0, splitIndex).trim().toLowerCase();
    const value = entry.slice(splitIndex + 1).trim();
    if (key && value) {
      detailMap.set(key, value);
    }
  }

  const summaryParts: string[] = [];
  const discipline = detailMap.get("discipline");
  const level = detailMap.get("level");
  const sessions = detailMap.get("sessions/week");
  const intensity = detailMap.get("intensity");

  if (discipline && discipline.toLowerCase() !== "n/a") {
    summaryParts.push(`discipline ${discipline}`);
  }
  if (level && level.toLowerCase() !== "n/a") {
    summaryParts.push(`level ${level}`);
  }
  if (sessions && sessions.toLowerCase() !== "n/a") {
    summaryParts.push(`${sessions} sessions/week`);
  }
  if (intensity && intensity.toLowerCase() !== "n/a") {
    summaryParts.push(`intensity ${intensity}`);
  }

  if (summaryParts.length === 0) {
    return "Lifestyle profile synced from onboarding input.";
  }
  return `Lifestyle profile synced (${summaryParts.join(", ")}).`;
};

const maskAccountIdentity = (rawAccount: string) => {
  const value = rawAccount.trim();
  if (!value) return "ATHLETE";

  const digitsOnly = value.replace(/\D/g, "");
  if (/^\d{11}$/.test(digitsOnly)) {
    return `${digitsOnly.slice(0, 3)}xxxx${digitsOnly.slice(-4)}`;
  }

  if (value.includes("@")) {
    const [namePart, domainPart] = value.split("@");
    if (!domainPart) return value;
    const prefix = namePart.slice(0, Math.min(3, namePart.length));
    return `${prefix}xxxx@${domainPart}`;
  }

  if (value.length >= 8) {
    return `${value.slice(0, 3)}xxxx${value.slice(-4)}`;
  }

  return value;
};

const isSensitiveIdentity = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return false;
  const digitsOnly = normalized.replace(/\D/g, "");
  if (/^\d{11}$/.test(digitsOnly)) return true;
  if (normalized.includes("@")) return true;
  if (/^\d{8,}$/.test(digitsOnly)) return true;
  return false;
};

const isDuplicateNicknameError = (rawMessage: string) => {
  const normalized = rawMessage.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes("nickname already exists") ||
    normalized.includes("display_name") ||
    normalized.includes("duplicate") ||
    normalized.includes("already exists") ||
    normalized.includes("uk_user_profile_display_name")
  );
};

const weakestAbilityLabels = (stats: AbilityProfileData) => {
  const labels: Record<string, string> = {
    strength: "Strength",
    power: "Power",
    endurance: "Endurance",
    mobility: "Mobility",
    stability: "Stability",
    speed: "Speed"
  };
  return Object.entries(stats)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([key]) => labels[key] ?? key);
};

export function AthleteProfilePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [latestAbility, setLatestAbility] = useState<AbilityProfileData | null>(null);
  const [abilityHistory, setAbilityHistory] = useState<AbilityHistoryData[]>([]);
  const [trainingHistory, setTrainingHistory] = useState<TrainingHistoryItem[]>([]);
  const [onboardingDraft, setOnboardingDraft] = useState<OnboardingDraft | null>(() =>
    readOnboardingDraft()
  );
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [goalAbilityTarget, setGoalAbilityTarget] = useState<AbilityProfileData | null>(() =>
    readGoalAbilityTarget()
  );

  const syncAuthDisplayName = (displayName: string | null | undefined) => {
    if (typeof window === "undefined") return;
    const normalized = (displayName || "").trim();
    if (
      normalized &&
      normalized.toLowerCase() !== "athlete" &&
      !isSensitiveIdentity(normalized)
    ) {
      window.localStorage.setItem(AUTH_DISPLAY_NAME_STORAGE_KEY, normalized);
    } else {
      window.localStorage.removeItem(AUTH_DISPLAY_NAME_STORAGE_KEY);
    }
    emitAuthStateChanged();
  };

  useEffect(() => {
    const syncDraft = () => {
      setOnboardingDraft(readOnboardingDraft());
    };
    syncDraft();
    if (typeof window === "undefined") return;
    window.addEventListener("storage", syncDraft);
    window.addEventListener("focus", syncDraft);
    return () => {
      window.removeEventListener("storage", syncDraft);
      window.removeEventListener("focus", syncDraft);
    };
  }, []);

  useEffect(() => {
    const syncGoalTarget = () => {
      setGoalAbilityTarget(readGoalAbilityTarget());
    };
    syncGoalTarget();
    if (typeof window === "undefined") return;
    window.addEventListener("storage", syncGoalTarget);
    window.addEventListener("focus", syncGoalTarget);
    return () => {
      window.removeEventListener("storage", syncGoalTarget);
      window.removeEventListener("focus", syncGoalTarget);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      setIsLoading(true);
      setLoadError(null);
      const userId = resolveProfileUserId();

      const [userResult, latestResult, abilityHistoryResult, trainingResult] =
        await Promise.allSettled([
          fetchUserProfile(userId),
          fetchAbilityProfileLatest(userId),
          fetchAbilityHistory(userId),
          fetchTrainingHistory(userId, 10)
        ]);

      if (cancelled) return;

      let successCount = 0;
      const failures: string[] = [];

      if (userResult.status === "fulfilled") {
        setProfile(userResult.value);
        syncAuthDisplayName(userResult.value.displayName);
        successCount += 1;
      } else {
        failures.push(
          userResult.reason instanceof Error ? userResult.reason.message : "Profile request failed."
        );
      }

      if (latestResult.status === "fulfilled") {
        setLatestAbility(latestResult.value);
        successCount += 1;
      } else {
        failures.push(
          latestResult.reason instanceof Error
            ? latestResult.reason.message
            : "Ability profile request failed."
        );
      }

      if (abilityHistoryResult.status === "fulfilled") {
        setAbilityHistory(abilityHistoryResult.value);
        successCount += 1;
      } else {
        failures.push(
          abilityHistoryResult.reason instanceof Error
            ? abilityHistoryResult.reason.message
            : "Ability history request failed."
        );
      }

      if (trainingResult.status === "fulfilled") {
        setTrainingHistory(trainingResult.value);
        successCount += 1;
      } else {
        failures.push(
          trainingResult.reason instanceof Error
            ? trainingResult.reason.message
            : "Training history request failed."
        );
      }

      if (successCount === 0) {
        setLoadError(failures[0] ?? "Failed to load athlete profile.");
      }

      setIsLoading(false);
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const abilityStats = useMemo<AbilityProfileData>(() => {
    const source = latestAbility ?? defaultAbilityStats;
    return {
      strength: clampStat(source.strength),
      power: clampStat(source.power),
      endurance: clampStat(source.endurance),
      mobility: clampStat(source.mobility),
      stability: clampStat(source.stability),
      speed: clampStat(source.speed)
    };
  }, [latestAbility]);

  const readiness = useMemo(() => {
    const values = Object.values(abilityStats);
    return Math.round(values.reduce((acc, item) => acc + item, 0) / values.length);
  }, [abilityStats]);

  const mergedProfile = useMemo<UserProfileData | null>(() => {
    if (!profile && !onboardingDraft) return null;

    const draftAge = toPositiveNumber(onboardingDraft?.age);
    const draftHeight = toPositiveNumber(onboardingDraft?.heightCm);
    const draftWeight = toPositiveNumber(onboardingDraft?.weightKg);
    const draftTrainingYears = toPositiveNumber(onboardingDraft?.trainingYears);
    const draftGender = parseDraftGender(onboardingDraft?.gender);
    const draftLifestyleNote = [
      onboardingDraft?.primaryDiscipline?.trim(),
      onboardingDraft?.movementInjuryHistory?.trim(),
      onboardingDraft?.weeklyRoutine?.trim(),
      onboardingDraft?.selfLevel?.trim()
    ]
      .filter(Boolean)
      .join(" | ");

    return {
      displayName: profile?.displayName || "Athlete",
      gender: profile?.gender && profile.gender > 0 ? profile.gender : draftGender,
      age: profile?.age && profile.age > 0 ? profile.age : draftAge,
      heightCm: profile?.heightCm && profile.heightCm > 0 ? profile.heightCm : draftHeight,
      weightKg: profile?.weightKg && profile.weightKg > 0 ? profile.weightKg : draftWeight,
      trainingYears:
        profile?.trainingYears && profile.trainingYears > 0
          ? profile.trainingYears
          : draftTrainingYears,
      lifestyleNote: profile?.lifestyleNote || draftLifestyleNote
    };
  }, [onboardingDraft, profile]);

  const accountIdentity = useMemo(
    () =>
      typeof window === "undefined"
        ? ""
        : (window.localStorage.getItem("authAccount") || "").trim(),
    []
  );

  const hasCustomNickname = useMemo(() => {
    const name = mergedProfile?.displayName?.trim() || "";
    if (!name) return false;
    if (isSensitiveIdentity(name)) return false;
    if (accountIdentity && name.toLowerCase() === accountIdentity.toLowerCase()) return false;
    return true;
  }, [accountIdentity, mergedProfile?.displayName]);

  const athleteName = useMemo(() => {
    const nameFromProfile = mergedProfile?.displayName?.trim();
    const accountRaw = accountIdentity;

    if (nameFromProfile) {
      if (isSensitiveIdentity(nameFromProfile)) {
        return maskAccountIdentity(nameFromProfile);
      }
      if (accountRaw && nameFromProfile === accountRaw) {
        return maskAccountIdentity(nameFromProfile);
      }
      return nameFromProfile;
    }

    if (accountRaw) {
      return maskAccountIdentity(accountRaw);
    }
    return "ATHLETE";
  }, [accountIdentity, mergedProfile?.displayName]);

  const openNicknameEditor = () => {
    const currentName = mergedProfile?.displayName?.trim() || "";
    const canUseCurrent =
      currentName &&
      !isSensitiveIdentity(currentName) &&
      (!accountIdentity || currentName.toLowerCase() !== accountIdentity.toLowerCase());
    setNicknameDraft(canUseCurrent ? currentName : "");
    setNicknameError(null);
    setIsEditingNickname(true);
  };

  const handleSaveNickname = async () => {
    const normalized = nicknameDraft.trim();
    if (normalized.length < 2) {
      setNicknameError("Nickname must be at least 2 characters.");
      return;
    }
    if (normalized.length > 24) {
      setNicknameError("Nickname must be 24 characters or fewer.");
      return;
    }
    if (isSensitiveIdentity(normalized)) {
      setNicknameError("Please use a nickname instead of phone/email account.");
      return;
    }
    if (isSavingNickname) return;

    setNicknameError(null);
    setIsSavingNickname(true);
    try {
      const userId = resolveProfileUserId();
      const availability = await checkDisplayNameAvailability({
        userId,
        displayName: normalized
      });
      if (!availability.available) {
        setNicknameError(DUPLICATE_NICKNAME_MESSAGE);
        return;
      }

      await updateUserProfile({
        userId,
        displayName: normalized
      });
      syncAuthDisplayName(normalized);
      setProfile((prev) => ({
        displayName: normalized,
        gender: prev?.gender ?? 0,
        age: prev?.age ?? 0,
        heightCm: prev?.heightCm ?? 0,
        weightKg: prev?.weightKg ?? 0,
        trainingYears: prev?.trainingYears ?? 0,
        lifestyleNote: prev?.lifestyleNote ?? ""
      }));
      setIsEditingNickname(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save nickname.";
      if (isDuplicateNicknameError(message)) {
        setNicknameError(DUPLICATE_NICKNAME_MESSAGE);
      } else {
        setNicknameError(message);
      }
    } finally {
      setIsSavingNickname(false);
    }
  };

  const status = readiness >= 85 ? "ELITE" : readiness >= 70 ? "ADVANCING" : "FOUNDATION";
  const rank = readiness >= 85 ? "TOP 5%" : readiness >= 70 ? "TOP 20%" : "TOP 40%";

  const athleteSummary = useMemo(() => {
    if (mergedProfile?.lifestyleNote) {
      const lifestyleSummary = buildPrivateLifestyleSummary(mergedProfile.lifestyleNote);
      return `${lifestyleSummary} Current emphasis should be quality movement under progressive load.`;
    }
    return "Current profile is synced from backend diagnostics. Continue consistent training and reassessment to improve weak links.";
  }, [mergedProfile?.lifestyleNote]);

  const targetAbilityStats = useMemo<AbilityProfileData>(() => {
    if (goalAbilityTarget) return goalAbilityTarget;
    return {
      mobility: clampStat(abilityStats.mobility + 8),
      stability: clampStat(abilityStats.stability + 8),
      strength: clampStat(abilityStats.strength + 6),
      power: clampStat(abilityStats.power + 6),
      endurance: clampStat(abilityStats.endurance + 6),
      speed: clampStat(abilityStats.speed + 7)
    };
  }, [goalAbilityTarget, abilityStats]);

  const abilityTrendData = useMemo<AbilityTrendPoint[]>(() => {
    if (!abilityHistory.length) {
      return [
        {
          label: "Now",
          ...abilityStats
        }
      ];
    }

    const sorted = abilityHistory
      .slice()
      .sort((a, b) => new Date(a.recordTime).getTime() - new Date(b.recordTime).getTime())
      .slice(-8);

    return sorted.map((item, index) => ({
      label: formatShortDate(item.recordTime) || `T${index + 1}`,
      mobility: clampStat(item.mobility),
      stability: clampStat(item.stability),
      strength: clampStat(item.strength),
      power: clampStat(item.power),
      endurance: clampStat(item.endurance),
      speed: clampStat(item.speed)
    }));
  }, [abilityHistory, abilityStats]);

  const trendDirection = (key: AbilityMetricKey) => {
    if (abilityTrendData.length < 2) return "N/A";
    const last = abilityTrendData[abilityTrendData.length - 1]?.[key] ?? 0;
    const prev = abilityTrendData[abilityTrendData.length - 2]?.[key] ?? 0;
    const diff = last - prev;
    if (diff >= 2) return "Up";
    if (diff <= -2) return "Down";
    return "Stable";
  };

  const abilityTrendNote =
    abilityHistory.length < 2
      ? "Need at least 2 saved ability assessments to show a real trend."
      : `${abilityHistory.length} backend assessment records synced.`;

  const historyItems = useMemo(() => {
    if (!trainingHistory.length) {
      return [
        { date: "--", activity: "No training runs yet", score: "N/A", type: "Awaiting data" }
      ];
    }

    return trainingHistory
      .slice()
      .sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      )
      .slice(0, 4)
      .map((item) => ({
        date: formatShortDate(item.startTime),
        activity: `Training Run #${item.runId}`,
        score: formatDuration(item.startTime, item.endTime),
        type: `Session ${item.sessionId}`
      }));
  }, [trainingHistory]);

  const weakestLabels = weakestAbilityLabels(abilityStats);
  const recommendationText = `Prioritize ${weakestLabels[0]} and ${weakestLabels[1]} with low-fatigue technique blocks before high-intensity work.`;

  const goalReadiness = useMemo(() => {
    const values = Object.values(targetAbilityStats);
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [targetAbilityStats]);

  const readinessDelta = goalReadiness - readiness;

  const trainingLoadSummary = useMemo(() => {
    const activeDays = new Set<string>();
    let totalMinutes = 0;
    for (const item of trainingHistory) {
      const start = new Date(item.startTime);
      const end = new Date(item.endTime);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      if (end.getTime() <= start.getTime()) continue;
      activeDays.add(formatLocalDayKey(start));
      totalMinutes += Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
    }
    return {
      sessions: trainingHistory.length,
      activeDays: activeDays.size,
      totalMinutes
    };
  }, [trainingHistory]);

  const lastSyncTime = useMemo(() => {
    const abilityTimestamp =
      abilityHistory.length > 0
        ? abilityHistory
            .slice()
            .sort(
              (a, b) =>
                new Date(b.recordTime).getTime() - new Date(a.recordTime).getTime()
            )[0]?.recordTime
        : "";
    const trainingTimestamp =
      trainingHistory.length > 0
        ? trainingHistory
            .slice()
            .sort(
              (a, b) =>
                new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
            )[0]?.startTime
        : "";
    const latest = abilityTimestamp || trainingTimestamp;
    if (!latest) return "No sync";
    return formatShortDate(latest);
  }, [abilityHistory, trainingHistory]);

  return (
    <div className="min-h-screen bg-[#07090d] text-zinc-100 pb-28">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        {isLoading && (
          <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
            Syncing athlete profile from backend...
          </div>
        )}

        {loadError && (
          <div className="mb-8 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            {loadError}
          </div>
        )}

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-1 gap-12 md:grid-cols-2 items-center"
        >
          <div className="relative order-2 md:order-1">
            <DualRadarChart current={abilityStats} target={targetAbilityStats} />
          </div>

          <div className="order-1 md:order-2 space-y-6">
            <div className="inline-flex items-center rounded-full border border-[#4edea3]/30 bg-[#4edea3]/10 px-3 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#4edea3]">
                Somatic Readiness
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                {athleteName}
              </h1>
              <button
                type="button"
                onClick={openNicknameEditor}
                className="rounded-full border border-[#4edea3]/40 bg-[#4edea3]/10 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4edea3] hover:bg-[#4edea3]/20"
              >
                {hasCustomNickname ? "Edit Nickname" : "Set Nickname"}
              </button>
            </div>
            {isEditingNickname && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Nickname</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    value={nicknameDraft}
                    onChange={(event) => {
                      setNicknameDraft(event.target.value);
                      setNicknameError(null);
                    }}
                    maxLength={24}
                    placeholder="Enter your nickname"
                    className="h-10 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white focus:border-[#4edea3]/40 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void handleSaveNickname();
                      }}
                      disabled={isSavingNickname}
                      className="rounded-xl bg-[#4edea3] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-black hover:bg-[#6ee7b7] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSavingNickname ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingNickname(false);
                        setNicknameError(null);
                      }}
                      className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300 hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                {nicknameError && (
                  <p className="mt-3 text-xs text-rose-300">{nicknameError}</p>
                )}
              </div>
            )}
            <div className="flex items-end gap-2">
              <p className="text-6xl font-semibold leading-none text-white">{readiness}</p>
              <span className="text-lg text-zinc-400">/100</span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed max-w-md">{athleteSummary}</p>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Rank</p>
                <p className="mt-1 text-lg font-semibold text-white">{rank}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Status</p>
                <p className="mt-1 text-lg font-semibold text-[#4edea3]">{status}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              <p>Age: {mergedProfile?.age || "--"}</p>
              <p>Gender: {genderLabel(mergedProfile?.gender ?? 0)}</p>
              <p>Height: {mergedProfile?.heightCm || "--"} cm</p>
              <p>Weight: {mergedProfile?.weightKg || "--"} kg</p>
              <p>Training Years: {mergedProfile?.trainingYears || "--"}</p>
              <p>User ID: {resolveProfileUserId()}</p>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mt-16 space-y-8"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-[#4edea3]">
              <History className="h-4 w-4" />
              Performance History
            </h2>
            <button className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
              Synced
            </button>
          </div>
          <div className="space-y-4">
            {historyItems.map((item) => (
              <div
                key={`${item.date}-${item.activity}`}
                className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-colors hover:border-[#4edea3]/30"
              >
                <div className="flex items-center gap-5">
                  <span className="w-16 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    {item.date}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.activity}</p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                      {item.type}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-[#4edea3]">{item.score}</span>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr] lg:items-stretch"
        >
          <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
                Ability Trend (6 Metrics)
              </h3>
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                Last sync: {lastSyncTime}
              </span>
            </div>
            <div className="mt-4">
              <AbilityTrendMultiLineChart data={abilityTrendData} />
            </div>
            <p className="mt-3 text-xs text-zinc-500">{abilityTrendNote}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[10px] uppercase tracking-[0.18em] text-zinc-400 sm:grid-cols-3">
              {ABILITY_METRIC_ORDER.map((metricKey) => (
                <div key={`direction-${metricKey}`} className="rounded-xl border border-white/10 bg-black/30 py-1.5">
                  <p>{ABILITY_METRIC_LABELS[metricKey]}</p>
                  <p className="mt-1 text-[#4edea3]">{trendDirection(metricKey)}</p>
                </div>
              ))}
            </div>
          </div>

          <ReadinessOrbPanel score={readiness} status={status} deltaToGoal={readinessDelta} />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr] lg:items-stretch"
        >
          <TrainingCalendarHeatmap sessions={trainingHistory} trailingDays={84} />
          <div className="flex h-full flex-col gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#4edea3]">
                Somatic Recommendation
              </h3>
              <p className="mt-3 border-l-2 border-[#4edea3]/40 pl-4 text-sm text-zinc-300">
                {recommendationText}
              </p>
              <div className="mt-5 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                <Zap className="h-4 w-4 text-[#4edea3]" />
                Goal readiness target: {goalReadiness}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
                Training Load Summary
              </h3>
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Sessions</p>
                  <p className="mt-1 text-xl font-semibold text-white">{trainingLoadSummary.sessions}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Active Days</p>
                  <p className="mt-1 text-xl font-semibold text-white">{trainingLoadSummary.activeDays}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Total Minutes</p>
                  <p className="mt-1 text-xl font-semibold text-white">{trainingLoadSummary.totalMinutes}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mt-16 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-[#4edea3]">
              System History
            </h3>
            <Link
              to="/system/history"
              className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400 hover:text-[#4edea3]"
            >
              View All
            </Link>
          </div>
          <div className="mt-4 space-y-3 text-sm text-zinc-300">
            {historyItems.slice(0, 3).map((item) => (
              <div
                key={`${item.date}-${item.activity}-mini`}
                className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/40 px-4 py-3"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{item.date}</p>
                  <p className="text-sm text-white">{item.activity}</p>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-[#4edea3]">
                  {item.score}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/system/assessment"
              className="flex-1 rounded-full bg-[#4edea3] px-6 py-3 text-center text-xs font-semibold uppercase tracking-[0.25em] text-black"
            >
              Start New Assessment
            </Link>
            <Link
              to="/system/goals"
              className="flex-1 rounded-full border border-[#4edea3]/40 bg-[#4edea3]/10 px-6 py-3 text-center text-xs font-semibold uppercase tracking-[0.25em] text-[#4edea3] hover:bg-[#4edea3]/20"
            >
              Reset Goals
            </Link>
            <Link
              to="/system/history"
              className="flex-1 rounded-full border border-white/10 px-6 py-3 text-center text-xs font-semibold uppercase tracking-[0.25em] text-white hover:bg-white/10"
            >
              View Full History
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
