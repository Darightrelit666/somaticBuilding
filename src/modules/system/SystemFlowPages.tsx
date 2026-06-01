import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  History,
  Info,
  Lightbulb,
  Lock,
  Mail,
  Mic,
  PlayCircle,
  Plus,
  Shield,
  StopCircle,
  User,
  Zap
} from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";
import { cn } from "../../shared/components/ui/utils";
import {
  AUTH_TOKEN_STORAGE_KEY,
  clearAuthToken,
  loginWithPassword,
  registerWithPassword,
  saveAuthToken
} from "../../shared/api/auth";
import {
  createAssessmentSession,
  fetchAssessmentSummary,
  fetchAssessmentTestList,
  saveAssessmentStep,
  saveAssessmentTestResult,
  type AssessmentSummaryData,
  type AssessmentTestData
} from "../../shared/api/assessment";
import {
  synthesizeGoal,
  type GoalSynthesisData
} from "../../shared/api/assistant";
import { createAbilityProfile, updateUserProfile } from "../../shared/api/profile";

const radarData = [
  { subject: "Mobility", A: 88, fullMark: 100 },
  { subject: "Stability", A: 72, fullMark: 100 },
  { subject: "Control", A: 94, fullMark: 100 },
  { subject: "Strength", A: 65, fullMark: 100 },
  { subject: "Power", A: 42, fullMark: 100 },
  { subject: "Endurance", A: 81, fullMark: 100 }
];

const trendData = [
  { name: "W1", mobility: 30, strength: 60, recovery: 80, power: 20 },
  { name: "W2", mobility: 45, strength: 62, recovery: 70, power: 40 },
  { name: "W3", mobility: 40, strength: 58, recovery: 50, power: 60 },
  { name: "W4", mobility: 65, strength: 65, recovery: 40, power: 85 },
  { name: "W5", mobility: 85, strength: 61, recovery: 20, power: 95 }
];

const riskAlerts = [
  {
    title: "Ankle Mobility: Low",
    description: "Significant limitation in dorsiflexion. High risk of knee stress during deep squats.",
    impact: "-12% vs Baseline"
  },
  {
    title: "Hip Stability: Deficient",
    description: "Internal rotation collapse observed. Risk of ACL strain detected.",
    impact: "High Neuromuscular Fatigue"
  }
];

const ASSESSMENT_SESSION_STORAGE_KEY = "assessmentActiveSessionId";
const ASSESSMENT_COMPLETED_STORAGE_KEY = "assessmentCompletedTestIds";
const DEFAULT_ASSESSMENT_USER_ID = 1;
const SYSTEM_ONBOARDING_DONE_KEY = "systemOnboardingCompleted";
const SYSTEM_GOAL_INPUT_KEY = "systemGoalInput";
const SYSTEM_GOAL_CONFIRMED_KEY = "systemGoalConfirmed";
const SYSTEM_GOAL_SYNTHESIS_KEY = "systemGoalSynthesis";
const ABILITY_PROFILE_SYNC_KEY_PREFIX = "systemAbilityProfileSyncedSession_";

const defaultGoalSynthesis: GoalSynthesisData = {
  summary: "Primary objective emphasizes quality movement and progressive loading.",
  recommendation:
    "Start with controlled form blocks, then increase load only when alignment stays consistent.",
  radar: [
    { subject: "Mobility", score: 88, fullMark: 100 },
    { subject: "Stability", score: 72, fullMark: 100 },
    { subject: "Control", score: 94, fullMark: 100 },
    { subject: "Strength", score: 65, fullMark: 100 },
    { subject: "Power", score: 42, fullMark: 100 },
    { subject: "Endurance", score: 81, fullMark: 100 }
  ],
  targets: [
    { label: "Hypertrophy", level: "High", score: 85 },
    { label: "Neural Adaptation", level: "Med", score: 60 },
    { label: "Injury Rehab", level: "Low", score: 20 },
    { label: "Metabolic Stress", level: "Med", score: 45 }
  ]
};

const FMS_TEST_ORDER = [
  "Deep Squat",
  "Hurdle Step",
  "Inline Lunge",
  "Shoulder Mobility",
  "Active Straight-Leg Raise",
  "Trunk Stability Push-Up",
  "Rotary Stability"
] as const;

const FMS_ORDER_MAP = new Map<string, number>(
  FMS_TEST_ORDER.map((name, index) => [name.toLowerCase(), index])
);

const fallbackAssessmentImages = [
  "https://images.unsplash.com/photo-1574673139737-c2021c2291f1?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=800"
];

const assessmentImageByName: Record<string, string> = {
  "deep squat":
    "https://images.unsplash.com/photo-1574673139737-c2021c2291f1?auto=format&fit=crop&q=80&w=800",
  "hurdle step":
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=800",
  "inline lunge":
    "https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&q=80&w=800",
  "active straight-leg raise":
    "https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&q=80&w=800",
  "shoulder mobility":
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=800",
  "trunk stability push-up":
    "https://images.unsplash.com/photo-1434682881908-b43d0467b798?auto=format&fit=crop&q=80&w=800",
  "rotary stability":
    "https://images.unsplash.com/photo-1579758629938-03607ccdbaba?auto=format&fit=crop&q=80&w=800"
};

const resolveAssessmentUserId = () => {
  if (typeof window === "undefined") return DEFAULT_ASSESSMENT_USER_ID;
  const raw =
    window.localStorage.getItem("workoutActiveUserId") ||
    window.localStorage.getItem("userId");
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ASSESSMENT_USER_ID;
};

const readAssessmentSessionId = () => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ASSESSMENT_SESSION_STORAGE_KEY);
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const writeAssessmentSessionId = (sessionId: number) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ASSESSMENT_SESSION_STORAGE_KEY, String(sessionId));
};

const readCompletedTestIds = () => {
  if (typeof window === "undefined") return [] as number[];
  const raw = window.localStorage.getItem(ASSESSMENT_COMPLETED_STORAGE_KEY);
  if (!raw) return [] as number[];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [] as number[];
    return parsed
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0);
  } catch {
    return [] as number[];
  }
};

const writeCompletedTestIds = (ids: number[]) => {
  if (typeof window === "undefined") return;
  const unique = Array.from(
    new Set(ids.filter((item) => Number.isFinite(item) && item > 0))
  );
  window.localStorage.setItem(ASSESSMENT_COMPLETED_STORAGE_KEY, JSON.stringify(unique));
};

const toTitleCase = (value: string) =>
  value
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1).toLowerCase())
    .join(" ");

const formatAssessmentCategory = (category: string) => {
  if (!category) return "Assessment";
  if (category.toLowerCase() === "movement") return "Functional Movement";
  if (category.toLowerCase() === "mobility") return "Mobility Screening";
  return toTitleCase(category);
};

const estimateTimeByCategory = (category: string) => {
  if (category.toLowerCase() === "movement") return "3m";
  if (category.toLowerCase() === "mobility") return "2m";
  return "3m";
};

const resolveAssessmentImage = (testName: string, fallbackIndex: number) => {
  const key = testName.trim().toLowerCase();
  if (assessmentImageByName[key]) return assessmentImageByName[key];
  return fallbackAssessmentImages[fallbackIndex % fallbackAssessmentImages.length];
};

const scoreLabelByValue: Record<number, string> = {
  0: "Pain",
  1: "Poor",
  2: "Fair",
  3: "Optimum"
};

const defaultFmsScoreDescriptions: Record<number, string> = {
  0: "Pain appears during the pattern.",
  1: "Unable to complete movement pattern.",
  2: "Completes pattern with compensation.",
  3: "Completes pattern with strong control."
};

const defaultCompensationChecks = [
  "Loss of neutral spine or trunk control",
  "Asymmetry between left and right sides",
  "Weight shift, valgus, or foot collapse"
];

const defaultFocusCues = [
  "Control tempo and keep breathing steady.",
  "Prioritize alignment before adding speed.",
  "Log which segment fails first under load."
];

const fmsProtocolByTest: Record<
  string,
  {
    scoreDescriptions: Record<number, string>;
    compensationChecks: string[];
    focusCues: string[];
  }
> = {
  "deep squat": {
    scoreDescriptions: {
      0: "Pain in squat pattern.",
      1: "Cannot descend with dowel alignment.",
      2: "Depth reached with heel lift or trunk lean.",
      3: "Depth and alignment maintained."
    },
    compensationChecks: [
      "Heels rise off floor early",
      "Knees collapse inward on descent",
      "Thoracic extension lost at bottom"
    ],
    focusCues: [
      "Anchor full foot pressure through mid-stance.",
      "Keep ribs stacked over pelvis at depth.",
      "Track knee path over second toe."
    ]
  },
  "hurdle step": {
    scoreDescriptions: {
      0: "Pain during hurdle step.",
      1: "Cannot clear hurdle with control.",
      2: "Clears hurdle with hip/knee instability.",
      3: "Stable clearance and return."
    },
    compensationChecks: [
      "Pelvis drops or rotates in single-leg stance",
      "Support leg loses tripod foot contact",
      "Lead leg contacts hurdle or drifts laterally"
    ],
    focusCues: [
      "Hold tall posture through single-leg stance.",
      "Control lead-leg path with minimal trunk sway.",
      "Compare left-right step quality."
    ]
  },
  "inline lunge": {
    scoreDescriptions: {
      0: "Pain in lunge sequence.",
      1: "Cannot complete lunge on line.",
      2: "Completes with wobble or balance loss.",
      3: "Maintains line control and upright torso."
    },
    compensationChecks: [
      "Front heel drifts off alignment line",
      "Torso rotates or laterally shifts",
      "Rear knee fails controlled descent"
    ],
    focusCues: [
      "Keep dowel points in contact throughout.",
      "Drive front foot evenly during ascent.",
      "Reduce frontal-plane sway rep to rep."
    ]
  },
  "shoulder mobility": {
    scoreDescriptions: {
      0: "Pain in shoulder pattern.",
      1: "Hands are well beyond target distance.",
      2: "Distance improves but asymmetry remains.",
      3: "Hands approach target with symmetry."
    },
    compensationChecks: [
      "Rib flare to fake shoulder range",
      "Scapular winging on reach",
      "Large asymmetry between sides"
    ],
    focusCues: [
      "Keep ribcage down while reaching.",
      "Track side-to-side gap measurements.",
      "Address thoracic extension restrictions."
    ]
  },
  "active straight-leg raise": {
    scoreDescriptions: {
      0: "Pain during leg raise.",
      1: "Leg cannot reach minimum benchmark.",
      2: "Range improves with pelvic movement.",
      3: "Range achieved with pelvic control."
    },
    compensationChecks: [
      "Opposite leg loses extension on floor",
      "Pelvis tilts or rotates to gain range",
      "Hamstring tension causes early compensation"
    ],
    focusCues: [
      "Maintain down-leg contact throughout.",
      "Control pelvis before chasing range.",
      "Note asymmetry and end-range quality."
    ]
  },
  "trunk stability push-up": {
    scoreDescriptions: {
      0: "Pain in push-up pattern.",
      1: "Cannot complete push-up as one unit.",
      2: "Completes with trunk sag/compensation.",
      3: "Strong en-bloc push with spinal control."
    },
    compensationChecks: [
      "Lumbar extension appears during press",
      "Elbow path flares excessively",
      "Hips and shoulders rise at different times"
    ],
    focusCues: [
      "Brace before initiating the press.",
      "Maintain straight-line body tension.",
      "Use tempo to reveal trunk breakdown."
    ]
  },
  "rotary stability": {
    scoreDescriptions: {
      0: "Pain in rotary stability pattern.",
      1: "Cannot complete ipsilateral pattern.",
      2: "Completes with balance drift/rotation.",
      3: "Controlled reciprocal pattern with symmetry."
    },
    compensationChecks: [
      "Pelvic rotation during limb lift",
      "Weight shift outside support base",
      "Timing mismatch between upper/lower limb"
    ],
    focusCues: [
      "Stabilize trunk before limb movement.",
      "Slow down to remove momentum cheats.",
      "Compare diagonal pattern consistency."
    ]
  }
};

const resolveFmsProtocol = (testName: string) => {
  const key = testName.trim().toLowerCase();
  return fmsProtocolByTest[key] ?? null;
};

const readAuthToken = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "";
};

const isSystemAuthed = () => Boolean(readAuthToken());

const useRequireSystemAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isSystemAuthed()) return;
    navigate("/system/login", {
      replace: true,
      state: {
        from: `${location.pathname}${location.search}`
      }
    });
  }, [location.pathname, location.search, navigate]);
};

const markOnboardingCompleted = () => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SYSTEM_ONBOARDING_DONE_KEY, "1");
};

const isOnboardingCompleted = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SYSTEM_ONBOARDING_DONE_KEY) === "1";
};

const saveGoalInput = (goalInput: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SYSTEM_GOAL_INPUT_KEY, goalInput);
  window.localStorage.setItem(SYSTEM_GOAL_CONFIRMED_KEY, "1");
};

const saveGoalDraftInput = (goalInput: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SYSTEM_GOAL_INPUT_KEY, goalInput);
};

const readGoalInput = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(SYSTEM_GOAL_INPUT_KEY) || "";
};

const markGoalUnconfirmed = () => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SYSTEM_GOAL_CONFIRMED_KEY, "0");
};

const isGoalConfirmed = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SYSTEM_GOAL_CONFIRMED_KEY) === "1";
};

const saveGoalSynthesis = (goalInput: string, synthesis: GoalSynthesisData) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SYSTEM_GOAL_SYNTHESIS_KEY,
    JSON.stringify({
      goalInput,
      synthesis,
      updatedAt: new Date().toISOString()
    })
  );
};

const readGoalSynthesis = (): { goalInput: string; synthesis: GoalSynthesisData } | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SYSTEM_GOAL_SYNTHESIS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const goalInput = typeof record.goalInput === "string" ? record.goalInput : "";
    const synthesis = record.synthesis;
    if (!goalInput.trim()) return null;
    if (typeof synthesis !== "object" || synthesis === null) return null;
    return {
      goalInput,
      synthesis: synthesis as GoalSynthesisData
    };
  } catch {
    return null;
  }
};

const clearGoalSynthesis = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SYSTEM_GOAL_SYNTHESIS_KEY);
};

const readLifestyleProfileForGoalSynthesis = () => {
  if (typeof window === "undefined") return "";
  const raw = window.localStorage.getItem("systemOnboardingDraft");
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return "";
    const record = parsed as Record<string, unknown>;

    const toValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    const primaryDiscipline = toValue(record.primaryDiscipline);
    const movementInjuryHistory = toValue(record.movementInjuryHistory);
    const weeklyRoutine = toValue(record.weeklyRoutine);
    const availableEquipment = toValue(record.availableEquipment);
    const selfLevel = toValue(record.selfLevel);
    const sessionsPerWeek = toValue(record.sessionsPerWeek);
    const typicalIntensity = toValue(record.typicalIntensity);

    return [
      `discipline:${primaryDiscipline || "N/A"}`,
      `history:${movementInjuryHistory || "N/A"}`,
      `routine:${weeklyRoutine || "N/A"}`,
      `equipment:${availableEquipment || "N/A"}`,
      `level:${selfLevel || "N/A"}`,
      `sessions/week:${sessionsPerWeek || "N/A"}`,
      `intensity:${typicalIntensity || "N/A"}`
    ].join(" | ");
  } catch {
    return "";
  }
};

const toUserGenderCode = (gender: "" | "male" | "female" | "other") => {
  if (gender === "male") return 1;
  if (gender === "female") return 2;
  return 0;
};

const parseTrainingYearsValue = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return 0;
  if (normalized === "10+") return 10;
  const matched = normalized.match(/\d+/);
  if (!matched) return 0;
  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clampAbilityScore = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const averageScore = (values: number[]) => {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
};

const hasSyncedAbilityProfile = (sessionId: number) => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(`${ABILITY_PROFILE_SYNC_KEY_PREFIX}${sessionId}`) === "1";
};

const markAbilityProfileSynced = (sessionId: number) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${ABILITY_PROFILE_SYNC_KEY_PREFIX}${sessionId}`, "1");
};

const buildAbilityProfileFromSummary = (summary: AssessmentSummaryData) => {
  const metrics = summary.jointMetrics || [];
  if (!metrics.length) return null;

  const mobilityAvg = averageScore(metrics.map((item) => item.mobility));
  const stabilityAvg = averageScore(metrics.map((item) => item.stability));
  const motorControlAvg = averageScore(metrics.map((item) => item.motorControl));
  const riskPenalty = Math.min(20, (summary.riskAlerts?.length || 0) * 3);

  return {
    mobility: clampAbilityScore(mobilityAvg),
    stability: clampAbilityScore(stabilityAvg),
    strength: clampAbilityScore(stabilityAvg * 0.6 + motorControlAvg * 0.4 - riskPenalty * 0.5),
    power: clampAbilityScore(motorControlAvg * 0.65 + mobilityAvg * 0.35 - riskPenalty),
    endurance: clampAbilityScore(stabilityAvg * 0.5 + mobilityAvg * 0.5 - riskPenalty * 0.33),
    speed: clampAbilityScore(motorControlAvg * 0.7 + mobilityAvg * 0.3 - riskPenalty * 0.5)
  };
};

const orderAssessmentTests = (tests: AssessmentTestData[]) => {
  return tests
    .slice()
    .sort((a, b) => {
      const aOrder = FMS_ORDER_MAP.get(a.name.toLowerCase()) ?? 999;
      const bOrder = FMS_ORDER_MAP.get(b.name.toLowerCase()) ?? 999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.id - b.id;
    });
};

export function SystemEntryPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-[#0f0f0f] text-zinc-100">
      <div className="absolute inset-0 opacity-25">
        <img
          src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=1920"
          className="h-full w-full object-cover grayscale"
          alt="Athlete"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-black/95" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center"
      >
        <p className="text-xs uppercase tracking-[0.4em] text-[#4edea3]">
          Somatic Building
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
          <span className="metallic-text">Enter the System</span>
        </h1>
        <p className="mt-4 text-sm uppercase tracking-[0.3em] text-zinc-300">
          Train. Refine. Repeat.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <button
            onClick={() => navigate("/system/login")}
            className="rounded-full border border-[#4edea3]/50 px-10 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#4edea3] transition hover:bg-[#4edea3]/10"
          >
            Start Experience
          </button>
          <button
            onClick={() => navigate("/system/login")}
            className="rounded-full border border-white/10 bg-white/5 px-10 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-white/10"
          >
            Login
          </button>
        </div>

        <div className="mt-12 flex items-center gap-12 border-t border-white/10 pt-8 text-left">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
              Latency
            </span>
            <span className="text-sm text-[#4edea3]">0.02ms</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
              Security
            </span>
            <span className="text-sm text-[#4edea3]">AES-256</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
              Status
            </span>
            <div className="flex items-center gap-2 text-sm text-[#4edea3]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4edea3] animate-pulse" />
              READY
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function SystemLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [account, setAccount] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    kind: "login" | "register";
    message: string;
  } | null>(null);

  const fallbackRedirect = "/system/onboarding";
  const redirectTo = useMemo(() => {
    const state = location.state as { from?: string } | null;
    const requested = state?.from;
    if (!requested) return fallbackRedirect;
    if (!requested.startsWith("/system/")) return fallbackRedirect;
    if (requested.startsWith("/system/login")) return fallbackRedirect;
    return requested;
  }, [location.state]);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const trimmedAccount = account.trim();
    const trimmedPhone = phone.trim();
    const trimmedPassword = password.trim();

    if (!trimmedPassword) {
      setNotice(null);
      setError("Password is required.");
      return;
    }

    if (mode === "login" && !trimmedAccount) {
      setNotice(null);
      setError("Email or phone is required.");
      return;
    }

    if (mode === "register" && !trimmedAccount && !trimmedPhone) {
      setNotice(null);
      setError("Provide at least one contact: email or phone.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === "login") {
        const { token } = await loginWithPassword({
          account: trimmedAccount,
          password: trimmedPassword
        });
        saveAuthToken(token);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("authAccount", trimmedAccount);
        }
        setNotice({
          kind: "login",
          message: "Login successful. Continue to the system flow."
        });
      } else {
        await registerWithPassword({
          password: trimmedPassword,
          email: trimmedAccount || undefined,
          phone: trimmedPhone || undefined
        });
        clearAuthToken();
        setMode("login");
        setPassword("");
        setNotice({
          kind: "register",
          message: "Registration successful. Please login to continue."
        });
      }
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Authentication failed.";
      setNotice(null);
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl"
      >
        <div className="text-center">
          <h2 className="text-2xl font-semibold uppercase tracking-[0.2em] text-[#4edea3]">
            Access Portal
          </h2>
          <p className="mt-2 text-[10px] uppercase tracking-[0.35em] text-zinc-400">
            Authentication Required
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/40 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
              setNotice(null);
            }}
            className={cn(
              "rounded-lg py-2 text-[10px] uppercase tracking-[0.2em] transition",
              mode === "login"
                ? "bg-[#4edea3] text-black"
                : "text-zinc-400 hover:text-white"
            )}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
              setNotice(null);
            }}
            className={cn(
              "rounded-lg py-2 text-[10px] uppercase tracking-[0.2em] transition",
              mode === "register"
                ? "bg-[#4edea3] text-black"
                : "text-zinc-400 hover:text-white"
            )}
          >
            Register
          </button>
        </div>

        <div className="mt-8 space-y-4">
          <label className="block text-[10px] uppercase tracking-[0.35em] text-zinc-400">
            {mode === "login" ? "Email or Phone" : "Email Address"}
            <div className="relative mt-2">
              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder={
                  mode === "login"
                    ? "athlete@somatic.pro or 13800138000"
                    : "athlete@somatic.pro"
                }
                className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-sm text-white focus:border-[#4edea3]/40 focus:outline-none"
              />
            </div>
          </label>

          {mode === "register" && (
            <label className="block text-[10px] uppercase tracking-[0.35em] text-zinc-400">
              Phone (Optional)
              <div className="relative mt-2">
                <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="13800138000"
                  className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-sm text-white focus:border-[#4edea3]/40 focus:outline-none"
                />
              </div>
            </label>
          )}

          <label className="block text-[10px] uppercase tracking-[0.35em] text-zinc-400">
            Password
            <div className="relative mt-2">
              <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleSubmit();
                  }
                }}
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-sm text-white focus:border-[#4edea3]/40 focus:outline-none"
              />
            </div>
          </label>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            void handleSubmit();
          }}
          className="gold-gradient mt-8 w-full rounded-xl py-3 text-xs font-semibold uppercase tracking-[0.3em] text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting
            ? mode === "login"
              ? "Authorizing..."
              : "Registering..."
            : mode === "login"
            ? "Authorize Access"
            : "Create Account"}
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-[0.3em] text-zinc-500">
            <span className="bg-[#0f0f0f] px-3">Or Connect With</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            disabled
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-[10px] uppercase tracking-[0.2em] text-white/60"
          >
            <Shield className="h-4 w-4 text-[#4edea3]" />
            Google
          </button>
          <button
            type="button"
            disabled
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-[10px] uppercase tracking-[0.2em] text-white/60"
          >
            <User className="h-4 w-4 text-[#4edea3]" />
            Apple
          </button>
        </div>

        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.3em] text-zinc-500">
          {mode === "login" ? "New Athlete?" : "Already registered?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode((prev) => (prev === "login" ? "register" : "login"));
              setError(null);
              setNotice(null);
            }}
            className="text-[#4edea3] hover:underline"
          >
            {mode === "login" ? "Register Trajectory" : "Use Login"}
          </button>
        </p>
      </motion.div>

      {notice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121212] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[#4edea3]">
              {notice.kind === "login" ? "Login Successful" : "Registration Successful"}
            </h3>
            <p className="mt-3 text-sm text-zinc-300">{notice.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              {notice.kind === "login" && (
                <button
                  type="button"
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300 hover:bg-white/10"
                  onClick={() => setNotice(null)}
                >
                  Stay
                </button>
              )}
              <button
                type="button"
                className="rounded-xl bg-[#4edea3] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-black hover:bg-[#6ee7b7]"
                onClick={() => {
                  if (notice.kind === "login") {
                    navigate(redirectTo);
                  } else {
                    setError(null);
                  }
                  setNotice(null);
                }}
              >
                {notice.kind === "login" ? "Continue" : "Go to Login"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SystemOnboardingPage() {
  useRequireSystemAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"" | "male" | "female" | "other">("");
  const [trainingYears, setTrainingYears] = useState("");
  const [primaryDiscipline, setPrimaryDiscipline] = useState("");
  const [movementInjuryHistory, setMovementInjuryHistory] = useState("");
  const [activityLevel, setActivityLevel] = useState(60);
  const [sessionsPerWeek, setSessionsPerWeek] = useState("");
  const [typicalIntensity, setTypicalIntensity] = useState("");
  const [weeklyRoutine, setWeeklyRoutine] = useState("");
  const [availableEquipment, setAvailableEquipment] = useState("");
  const [selfLevel, setSelfLevel] = useState("");
  const [stepError, setStepError] = useState<string | null>(null);

  const validateCurrentStep = () => {
    if (step === 1) {
      const parsedHeight = Number(heightCm);
      const parsedWeight = Number(weightKg);
      const parsedAge = Number(age);
      if (!Number.isFinite(parsedHeight) || parsedHeight <= 0) {
        return "Please enter a valid height (cm).";
      }
      if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
        return "Please enter a valid weight (kg).";
      }
      if (!Number.isFinite(parsedAge) || parsedAge <= 0) {
        return "Please enter a valid age.";
      }
      if (!gender) {
        return "Please select your gender.";
      }
      return null;
    }

    if (step === 2) {
      if (!trainingYears) {
        return "Please select training years.";
      }
      if (!primaryDiscipline.trim()) {
        return "Please fill in your primary discipline.";
      }
      if (movementInjuryHistory.trim().length < 10) {
        return "Please provide your movement and injury history details.";
      }
      return null;
    }

    if (!sessionsPerWeek.trim()) {
      return "Please fill in sessions per week.";
    }
    if (!typicalIntensity.trim()) {
      return "Please fill in typical intensity.";
    }
    if (!weeklyRoutine.trim()) {
      return "Please describe your weekly routine.";
    }
    if (!availableEquipment.trim()) {
      return "Please list available equipment.";
    }
    if (!selfLevel.trim()) {
      return "Please fill in your self-assessed level.";
    }
    return null;
  };

  const handleStepNext = () => {
    const validationError = validateCurrentStep();
    if (validationError) {
      setStepError(validationError);
      return;
    }
    setStepError(null);
    setStep((prev) => Math.min(3, prev + 1));
  };

  const handleFinishSetup = async () => {
    const validationError = validateCurrentStep();
    if (validationError) {
      setStepError(validationError);
      return;
    }
    setStepError(null);

    const normalizedPrimaryDiscipline = primaryDiscipline.trim();
    const normalizedMovementInjuryHistory = movementInjuryHistory.trim();
    const normalizedWeeklyRoutine = weeklyRoutine.trim();
    const normalizedEquipment = availableEquipment.trim();
    const normalizedSelfLevel = selfLevel.trim();
    const normalizedSessionsPerWeek = sessionsPerWeek.trim();
    const normalizedTypicalIntensity = typicalIntensity.trim();

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "systemOnboardingDraft",
        JSON.stringify({
          heightCm: Number(heightCm),
          weightKg: Number(weightKg),
          age: Number(age),
          gender,
          trainingYears,
          primaryDiscipline: normalizedPrimaryDiscipline,
          movementInjuryHistory: normalizedMovementInjuryHistory,
          activityLevel,
          sessionsPerWeek: normalizedSessionsPerWeek,
          typicalIntensity: normalizedTypicalIntensity,
          weeklyRoutine: normalizedWeeklyRoutine,
          availableEquipment: normalizedEquipment,
          selfLevel: normalizedSelfLevel
        })
      );
    }

    const lifestyleNote = [
      `discipline:${normalizedPrimaryDiscipline || "N/A"}`,
      `history:${normalizedMovementInjuryHistory || "N/A"}`,
      `routine:${normalizedWeeklyRoutine || "N/A"}`,
      `equipment:${normalizedEquipment || "N/A"}`,
      `level:${normalizedSelfLevel || "N/A"}`,
      `sessions/week:${normalizedSessionsPerWeek || "N/A"}`,
      `intensity:${normalizedTypicalIntensity || "N/A"}`
    ].join(" | ");

    try {
      const userId = resolveAssessmentUserId();
      await updateUserProfile({
        userId,
        gender: toUserGenderCode(gender),
        age: Number(age),
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
        trainingYears: parseTrainingYearsValue(trainingYears),
        lifestyleNote
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sync profile.";
      if (typeof window !== "undefined") {
        window.localStorage.setItem("systemProfileSyncError", message);
      }
    }

    markOnboardingCompleted();
    navigate("/system/goals");
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100 px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#4edea3]/30 bg-[#4edea3]/10">
              <User className="h-5 w-5 text-[#4edea3]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold uppercase tracking-tight text-white">
                Somatic Profile
              </h2>
              <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">
                Step {step} of 3
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-2 w-10 rounded-full",
                  i <= step ? "bg-[#4edea3]" : "bg-white/10"
                )}
              />
            ))}
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          {step === 1 && (
            <>
              <h3 className="text-3xl font-semibold text-white">Biological Baselines</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Record your core stats so we can calibrate intensity and recovery.
              </p>
              <div className="mt-8 grid gap-6 md:grid-cols-2">
                {[
                  { label: "Height (cm)", placeholder: "185" },
                  { label: "Weight (kg)", placeholder: "80" },
                  { label: "Age", placeholder: "24" }
                ].map((field) => (
                  <label
                    key={field.label}
                    className="text-xs uppercase tracking-[0.3em] text-zinc-400"
                  >
                    {field.label}
                    <input
                      type="number"
                      value={
                        field.label === "Height (cm)"
                          ? heightCm
                          : field.label === "Weight (kg)"
                          ? weightKg
                          : age
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        if (field.label === "Height (cm)") {
                          setHeightCm(value);
                        } else if (field.label === "Weight (kg)") {
                          setWeightKg(value);
                        } else {
                          setAge(value);
                        }
                        setStepError(null);
                      }}
                      placeholder={field.placeholder}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-[#4edea3]/40 focus:outline-none"
                    />
                  </label>
                ))}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-zinc-400">
                    Gender
                  </label>
                  <div className="flex rounded-xl border border-white/10 bg-black/40 p-1">
                    {["Male", "Female", "Other"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          const normalized =
                            option.toLowerCase() as "male" | "female" | "other";
                          setGender(normalized);
                          setStepError(null);
                        }}
                        className={cn(
                          "flex-1 rounded-lg py-2 text-[10px] uppercase tracking-[0.2em] transition",
                          gender === option.toLowerCase()
                            ? "bg-[#4edea3] text-black"
                            : "text-zinc-400 hover:text-white"
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h3 className="text-3xl font-semibold text-white">Training Experience</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Tell us about your background and injury context in one narrative for AI analysis.
              </p>
              <div className="mt-8 grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <label className="text-xs uppercase tracking-[0.3em] text-zinc-400">
                    Years of Competitive Sport
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {["0-2", "3-5", "6-10", "10+"].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setTrainingYears(value);
                          setStepError(null);
                        }}
                        className={cn(
                          "rounded-lg border py-3 text-[10px] uppercase tracking-[0.2em] transition",
                          trainingYears === value
                            ? "border-[#4edea3] bg-[#4edea3]/20 text-[#4edea3]"
                            : "border-white/10 bg-black/40 text-zinc-400 hover:border-[#4edea3]/40 hover:text-white"
                        )}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="text-xs uppercase tracking-[0.3em] text-zinc-400">
                  Primary Discipline
                  <input
                    type="text"
                    value={primaryDiscipline}
                    onChange={(event) => {
                      setPrimaryDiscipline(event.target.value);
                      setStepError(null);
                    }}
                    placeholder="Strength / Basketball / Mixed"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-[#4edea3]/40 focus:outline-none"
                  />
                </label>
              </div>
              <label className="mt-6 block text-xs uppercase tracking-[0.3em] text-zinc-400">
                Movement & Injury History (Unified Narrative)
                <textarea
                  value={movementInjuryHistory}
                  onChange={(event) => {
                    setMovementInjuryHistory(event.target.value);
                    setStepError(null);
                  }}
                  className="mt-2 h-32 w-full resize-none rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-white focus:border-[#4edea3]/40 focus:outline-none"
                  placeholder="Describe training history and injury constraints together: preferred movement styles, surgeries, pain areas, recurring limitations, and timeline..."
                />
              </label>
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="text-3xl font-semibold text-white">Lifestyle & Capacity</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Capture your weekly rhythm so we can tune the program.
              </p>
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-[0.3em] text-zinc-400">
                    Daily Activity Level
                  </label>
                  <span className="text-[10px] uppercase tracking-[0.25em] text-[#4edea3]">
                    {activityLevel >= 75
                      ? "High Performance"
                      : activityLevel >= 40
                      ? "Active"
                      : "Foundational"}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={activityLevel}
                  onChange={(event) => {
                    setActivityLevel(Number(event.target.value));
                    setStepError(null);
                  }}
                  className="mt-4 w-full accent-[#4edea3]"
                />
                <div className="mt-2 flex justify-between text-[8px] uppercase tracking-[0.3em] text-zinc-500">
                  <span>Sedentary</span>
                  <span>Active</span>
                  <span>Elite</span>
                </div>
              </div>
              <div className="mt-8 grid gap-6 md:grid-cols-2">
                <label className="text-xs uppercase tracking-[0.3em] text-zinc-400">
                  Sessions / Week
                  <input
                    type="text"
                    value={sessionsPerWeek}
                    onChange={(event) => {
                      setSessionsPerWeek(event.target.value);
                      setStepError(null);
                    }}
                    placeholder="3-4"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-[#4edea3]/40 focus:outline-none"
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.3em] text-zinc-400">
                  Typical Intensity
                  <input
                    type="text"
                    value={typicalIntensity}
                    onChange={(event) => {
                      setTypicalIntensity(event.target.value);
                      setStepError(null);
                    }}
                    placeholder="Moderate / High"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-[#4edea3]/40 focus:outline-none"
                  />
                </label>
              </div>
              <label className="mt-6 block text-xs uppercase tracking-[0.3em] text-zinc-400">
                Weekly Routine (Narrative)
                <textarea
                  value={weeklyRoutine}
                  onChange={(event) => {
                    setWeeklyRoutine(event.target.value);
                    setStepError(null);
                  }}
                  className="mt-2 h-28 w-full resize-none rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-white focus:border-[#4edea3]/40 focus:outline-none"
                  placeholder="Describe your weekly schedule, sleep, recovery, and stress load..."
                />
              </label>
              <label className="mt-6 block text-xs uppercase tracking-[0.3em] text-zinc-400">
                Available Movements / Equipment
                <textarea
                  value={availableEquipment}
                  onChange={(event) => {
                    setAvailableEquipment(event.target.value);
                    setStepError(null);
                  }}
                  className="mt-2 h-24 w-full resize-none rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-white focus:border-[#4edea3]/40 focus:outline-none"
                  placeholder="List available equipment or movements you can perform..."
                />
              </label>
              <label className="mt-6 block text-xs uppercase tracking-[0.3em] text-zinc-400">
                Self-Assessed Level
                <input
                  type="text"
                  value={selfLevel}
                  onChange={(event) => {
                    setSelfLevel(event.target.value);
                    setStepError(null);
                  }}
                  placeholder="Beginner / Intermediate / Advanced"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-[#4edea3]/40 focus:outline-none"
                />
              </label>
            </>
          )}

          <div className="mt-8 flex flex-wrap gap-4">
            {step > 1 && (
              <button
                onClick={() => {
                  setStepError(null);
                  setStep((prev) => Math.max(1, prev - 1));
                }}
                className="rounded-full border border-white/10 px-8 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white hover:bg-white/10"
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={handleStepNext}
                className="rounded-full border border-[#4edea3]/50 px-8 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#4edea3] hover:bg-[#4edea3]/10"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleFinishSetup}
                className="rounded-full bg-[#4edea3] px-8 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-black hover:bg-[#6ee7b7]"
              >
                Finish Setup
              </button>
            )}
          </div>
          {stepError && (
            <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {stepError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function SystemGoalEntryPage() {
  useRequireSystemAuth();
  const navigate = useNavigate();
  const [goalInput, setGoalInput] = useState(() => readGoalInput());
  const [goalError, setGoalError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [goalAnalysis, setGoalAnalysis] = useState<GoalSynthesisData | null>(() => {
    const cached = readGoalSynthesis();
    return cached?.synthesis ?? null;
  });
  const [analyzedInput, setAnalyzedInput] = useState(() => {
    const cached = readGoalSynthesis();
    return cached?.goalInput ?? "";
  });

  useEffect(() => {
    if (!isOnboardingCompleted()) {
      navigate("/system/onboarding", { replace: true });
    }
  }, [navigate]);

  const normalizedGoalInput = goalInput.trim();
  const hasUsableAnalysis = Boolean(
    goalAnalysis &&
      normalizedGoalInput.length > 0 &&
      normalizedGoalInput === analyzedInput
  );

  const radarSeries = useMemo(
    () =>
      (goalAnalysis?.radar?.length ? goalAnalysis.radar : defaultGoalSynthesis.radar).map((item) => ({
        subject: item.subject,
        A: item.score,
        fullMark: item.fullMark
      })),
    [goalAnalysis]
  );

  const targetWeights = useMemo(
    () => goalAnalysis?.targets?.length ? goalAnalysis.targets : defaultGoalSynthesis.targets,
    [goalAnalysis]
  );

  const recommendationText = goalAnalysis?.recommendation || defaultGoalSynthesis.recommendation;
  const synthesisSummary = goalAnalysis?.summary || defaultGoalSynthesis.summary;

  const handleAnalyzeGoals = async () => {
    if (isAnalyzing) return;
    const normalized = normalizedGoalInput;
    if (normalized.length < 10) {
      setGoalError("Please describe your training goal with more details.");
      return;
    }

    setGoalError(null);
    setAnalysisError(null);
    setIsAnalyzing(true);
    markGoalUnconfirmed();
    saveGoalDraftInput(normalized);

    try {
      const synthesis = await synthesizeGoal({
        userId: resolveAssessmentUserId(),
        goalInput: normalized,
        lifestyleProfile: readLifestyleProfileForGoalSynthesis() || undefined
      });
      setGoalAnalysis(synthesis);
      setAnalyzedInput(normalized);
      saveGoalSynthesis(normalized, synthesis);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to analyze goals.";
      setAnalysisError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmGoals = () => {
    const normalized = goalInput.trim();
    if (normalized.length < 10) {
      setGoalError("Please describe your training goal with more details.");
      return;
    }
    if (!goalAnalysis || normalized !== analyzedInput) {
      setAnalysisError("Please run AI analysis for the current goal before continuing.");
      return;
    }

    setGoalError(null);
    setAnalysisError(null);
    saveGoalInput(normalized);
    saveGoalSynthesis(normalized, goalAnalysis);
    navigate("/system/assessment");
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100 px-6 py-16">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-8">
          <h2 className="text-4xl font-semibold text-white">
            Define Your <span className="text-[#4edea3]">Trajectory</span>.
          </h2>
          <p className="text-zinc-300">
            Our AI engine decodes your goals to construct a high-precision performance model.
          </p>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <label className="text-[10px] uppercase tracking-[0.3em] text-zinc-400">
              Raw Input Stream
            </label>
            <textarea
              value={goalInput}
              onChange={(event) => {
                const nextValue = event.target.value;
                setGoalInput(nextValue);
                setGoalError(null);
                setAnalysisError(null);
                saveGoalDraftInput(nextValue);
                markGoalUnconfirmed();
              }}
              className="mt-4 h-48 w-full resize-none rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-white focus:border-[#4edea3]/40 focus:outline-none"
              placeholder="e.g., Increase vertical jump by 4 inches..."
            />
            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-[10px] uppercase tracking-[0.3em] text-zinc-400">
              <span className="flex items-center gap-2">
                <Mic className="h-3 w-3" /> Natural Language Mode
              </span>
              <span className="flex items-center gap-2 text-[#4edea3]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4edea3] animate-pulse" />
                {isAnalyzing
                  ? "AI Analyzing..."
                  : hasUsableAnalysis
                  ? "Analysis Ready"
                  : goalAnalysis
                  ? "Re-analysis Required"
                  : "Awaiting Analysis"}
              </span>
            </div>
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                void handleAnalyzeGoals();
              }}
              disabled={isAnalyzing}
              className="rounded-full bg-[#4edea3] px-8 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-black hover:bg-[#6ee7b7] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Goals"}
            </button>
            <button
              type="button"
              onClick={handleConfirmGoals}
              disabled={!hasUsableAnalysis || isAnalyzing}
              className="rounded-full border border-[#4edea3]/50 bg-[#4edea3]/10 px-8 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#4edea3] hover:bg-[#4edea3]/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => {
                setGoalInput("");
                setGoalError(null);
                setAnalysisError(null);
                setGoalAnalysis(null);
                setAnalyzedInput("");
                clearGoalSynthesis();
                saveGoalDraftInput("");
                markGoalUnconfirmed();
              }}
              className="rounded-full border border-white/10 px-8 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white hover:bg-white/10"
            >
              Reset
            </button>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-zinc-300">
            {synthesisSummary}
          </div>
          {goalError && (
            <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {goalError}
            </p>
          )}
          {analysisError && (
            <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              {analysisError}
            </p>
          )}
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-xs uppercase tracking-[0.3em] text-[#4edea3]">Biometric Synthesis</h3>
            <div className="mt-6 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarSeries} cx="50%" cy="50%" outerRadius="80%">
                  <PolarGrid stroke="#4d4635" strokeOpacity={0.2} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#4edea3", fontSize: 10 }} />
                  <Radar dataKey="A" stroke="#4edea3" fill="#4edea3" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 space-y-4">
              <h4 className="text-[10px] uppercase tracking-[0.25em] text-zinc-400">Structured Targets</h4>
              {targetWeights.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs text-zinc-300">
                  <span>{item.label}</span>
                  <div className="flex items-center gap-3">
                    <div className="h-1 w-24 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#4edea3]"
                        style={{ width: `${Math.max(0, Math.min(100, item.score))}%` }}
                      />
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#4edea3]">
                      {item.level}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[#4edea3]/20 bg-[#4edea3]/10 p-6 text-xs text-zinc-200">
            <div className="flex items-center gap-2 text-[#4edea3]">
              <Lightbulb className="h-4 w-4" />
              AI Recommendation
            </div>
            <p className="mt-2 text-zinc-300">
              {recommendationText}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SystemAssessmentIntroPage() {
  useRequireSystemAuth();
  const navigate = useNavigate();
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOnboardingCompleted()) {
      navigate("/system/onboarding", { replace: true });
      return;
    }
    if (!isGoalConfirmed()) {
      navigate("/system/goals", { replace: true });
    }
  }, [navigate]);

  const handleBeginDiagnostic = async () => {
    if (isStarting) return;
    setStartError(null);
    setIsStarting(true);
    try {
      const userId = resolveAssessmentUserId();
      const { id: sessionId } = await createAssessmentSession(userId);
      writeAssessmentSessionId(sessionId);
      writeCompletedTestIds([]);
      await saveAssessmentStep({
        sessionId,
        stepType: "intro",
        stepStatus: 1
      }).catch(() => {
        // Assessment flow should continue even if step logging fails.
      });
      navigate("/system/assessment-list");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to initialize assessment.";
      setStartError(message);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100 px-6 py-12">
      <div className="mx-auto flex max-w-5xl flex-col justify-center space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-12"
        >
          <div className="space-y-4">
            <span className="text-xs font-semibold uppercase tracking-[0.4em] text-[#4edea3]">
              Protocol Initialization
            </span>
            <h2 className="text-5xl font-semibold text-white sm:text-6xl">
              Somatic <br /> Diagnostic Phase
            </h2>
          </div>

          <div className="grid gap-12 md:grid-cols-2">
            <div className="space-y-6">
              <p className="text-lg text-zinc-300">
                We are about to execute a comprehensive{" "}
                <span className="text-white font-semibold">Functional Movement Screen (FMS)</span>. This
                clinical protocol identifies structural inefficiencies, mobility restrictions, and stability
                deficits.
              </p>
              <div className="space-y-4">
                {[
                  { icon: <Activity className="h-5 w-5" />, title: "7 Core Movements", desc: "Testing fundamental patterns" },
                  { icon: <Zap className="h-5 w-5" />, title: "Joint Specifics", desc: "Ankle, Hip, and Shoulder mobility" },
                  { icon: <Shield className="h-5 w-5" />, title: "Stability Check", desc: "Core and pelvic control metrics" }
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="rounded-lg bg-[#4edea3]/10 p-2 text-[#4edea3]">{item.icon}</div>
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-widest text-white">
                        {item.title}
                      </h4>
                      <p className="text-xs text-zinc-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8">
              <div className="absolute right-6 top-6 text-[#4edea3]/40">
                <Info className="h-6 w-6" />
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.25em] text-[#4edea3] mb-6">
                Preparation
              </h4>
              <ul className="space-y-4 text-sm text-zinc-300">
                {[
                  "Ensure 2m x 2m clear space",
                  "Wear athletic/form-fitting apparel",
                  "Position camera at hip height",
                  "Estimated duration: 15-20 minutes"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#4edea3]" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-10 rounded-xl border border-white/10 bg-black/40 p-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                * AI analysis will be active during movements to detect compensations in real-time.
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              disabled={isStarting}
              onClick={() => {
                void handleBeginDiagnostic();
              }}
              className="w-full md:w-auto rounded-xl bg-[#4edea3] px-16 py-5 text-xs font-semibold uppercase tracking-[0.3em] text-black shadow-2xl shadow-[#4edea3]/20 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
            >
              {isStarting ? "Initializing..." : "Begin Diagnostic"}
            </button>
            {startError && (
              <p className="max-w-xl rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                {startError}
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function SystemAssessmentListPage() {
  useRequireSystemAuth();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [tests, setTests] = useState<AssessmentTestData[]>([]);
  const [completedIds, setCompletedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOnboardingCompleted()) {
      navigate("/system/onboarding", { replace: true });
      return;
    }
    if (!isGoalConfirmed()) {
      navigate("/system/goals", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const activeSessionId = readAssessmentSessionId();
        if (!activeSessionId) {
          throw new Error("No active assessment session. Please start from diagnostic intro.");
        }
        if (cancelled) return;
        setSessionId(activeSessionId);

        const remoteTests = await fetchAssessmentTestList(activeSessionId);
        if (cancelled) return;
        const orderedTests = orderAssessmentTests(remoteTests);
        setTests(orderedTests);
        const storedCompleted = readCompletedTestIds();
        setCompletedIds(storedCompleted);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load assessment tests.";
        setLoadError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalCount = tests.length;
  const completedCount = tests.filter((test) => completedIds.includes(test.id)).length;
  const progressRatio = totalCount > 0 ? completedCount / totalCount : 0;
  const firstPendingIndex = tests.findIndex((test) => !completedIds.includes(test.id));
  const currentUnlockedIndex =
    firstPendingIndex === -1 ? Math.max(0, tests.length - 1) : firstPendingIndex;
  const currentUnlockedTest = tests[currentUnlockedIndex];
  const allTestsCompleted = totalCount > 0 && completedCount >= totalCount;
  const effectiveTests = tests.map((test, index) => ({
    ...test,
    imageUrl: resolveAssessmentImage(test.name, index),
    displayCategory: formatAssessmentCategory(test.category),
    estTime: estimateTimeByCategory(test.category),
    completed: completedIds.includes(test.id),
    locked: tests.length > 0 && index > currentUnlockedIndex && !completedIds.includes(test.id)
  }));

  const handleOpenTest = (testId: number) => {
    const targetIndex = tests.findIndex((item) => item.id === testId);
    if (targetIndex < 0) return;
    if (targetIndex > currentUnlockedIndex && !completedIds.includes(testId)) {
      const nextName = currentUnlockedTest?.name || "current active test";
      setFlowError(
        `Please complete assessments in sequence. Continue from: ${nextName}.`
      );
      return;
    }
    setFlowError(null);
    navigate(`/system/assessment-active?testId=${testId}`);
  };

  const hasActiveSessionError =
    !!loadError && loadError.toLowerCase().includes("no active assessment session");

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100 px-6 py-12">
      <div className="mx-auto max-w-7xl pb-24">
        <section className="grid gap-6 lg:grid-cols-12 items-end mb-12">
          <div className="lg:col-span-8">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4edea3] block mb-2">
              Current Protocol
            </span>
            <h1 className="text-4xl font-semibold text-white sm:text-5xl">
              Functional Movement <br /> Screening (FMS)
            </h1>
            <p className="mt-4 max-w-xl text-lg text-zinc-400">
              Perform the following tests to establish your somatic baseline and identify mechanical
              inefficiencies.
            </p>
            {sessionId && (
              <p className="mt-3 text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                Session ID: {sessionId}
              </p>
            )}
          </div>
          <div className="lg:col-span-4">
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-6">
              <div className="relative z-10 flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-400">
                  Overall Progress
                </span>
                <div className="mt-2 flex items-end justify-between">
                  <span className="text-5xl font-semibold text-[#4edea3]">
                    {completedCount}/{totalCount || 0}
                  </span>
                  <span className="pb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">Completed</span>
                </div>
                <div className="mt-4 h-1.5 w-full rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full bg-[#4edea3] shadow-[0_0_10px_rgba(78,222,163,0.5)] transition-all"
                    style={{ width: `${Math.max(8, Math.round(progressRatio * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {isLoading && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-zinc-300">
            Loading assessment tests...
          </div>
        )}

        {loadError && (
          <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
            {loadError}
            {hasActiveSessionError && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => navigate("/system/assessment")}
                  className="rounded-lg border border-rose-200/40 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-rose-100 hover:bg-rose-500/10"
                >
                  Go to Assessment Intro
                </button>
              </div>
            )}
          </div>
        )}
        {flowError && (
          <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-200">
            {flowError}
          </div>
        )}

        {!isLoading && !loadError && currentUnlockedTest && (
          <div className="mb-6 rounded-xl border border-[#4edea3]/30 bg-[#4edea3]/10 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#9af2cd]">
                  {allTestsCompleted ? "Protocol Complete" : "Current Active Test"}
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {allTestsCompleted
                    ? "All FMS tests are complete. You can finalize assessment."
                    : currentUnlockedTest.name}
                </p>
                {!allTestsCompleted && (
                  <p className="mt-1 text-xs text-zinc-300">
                    Sequence is enforced to keep the FMS signal consistent and comparable.
                  </p>
                )}
              </div>
              {!allTestsCompleted && (
                <button
                  type="button"
                  onClick={() => handleOpenTest(currentUnlockedTest.id)}
                  className="rounded-lg bg-[#4edea3] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-black hover:bg-[#6ee7b7]"
                >
                  Continue
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {effectiveTests.map((test) => (
            <div
              key={test.id}
              className={cn(
                "group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all",
                test.completed
                  ? "border-[#4edea3] shadow-lg shadow-[#4edea3]/10"
                  : "hover:border-[#4edea3]/30"
              )}
            >
              <div className="relative h-48 w-full">
                <img
                  src={test.imageUrl}
                  alt={test.name}
                  className={cn(
                    "h-full w-full object-cover transition-all duration-500",
                    test.completed
                      ? "grayscale-0 opacity-100"
                      : "grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100"
                  )}
                />
                <div className="absolute right-4 top-4">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em]",
                      test.completed
                        ? "bg-[#4edea3] text-black shadow-lg"
                        : test.locked
                        ? "bg-black/70 text-zinc-400"
                        : "bg-black/60 text-[#4edea3]"
                    )}
                  >
                    {test.completed ? "Completed" : test.locked ? "Locked" : "Ready"}
                  </span>
                </div>
              </div>
              <div
                className={cn(
                  "flex flex-1 flex-col p-6",
                  test.completed ? "bg-white/[0.04]" : ""
                )}
              >
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="text-xl font-semibold text-white">{test.name}</h3>
                  <Info className="h-5 w-5 text-zinc-500" />
                </div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-6">
                  {test.displayCategory}
                </p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    {test.completed ? "Result Saved" : `Est. Time: ${test.estTime}`}
                  </span>
                  <button
                    type="button"
                    disabled={test.locked}
                    onClick={() => handleOpenTest(test.id)}
                    className={cn(
                      "rounded-lg p-2 transition-all",
                      test.completed
                        ? "bg-[#4edea3] text-black hover:scale-105"
                        : test.locked
                        ? "cursor-not-allowed text-zinc-500"
                        : "text-[#4edea3] hover:bg-[#4edea3]/10"
                    )}
                  >
                    {test.completed ? (
                      <StopCircle className="h-6 w-6" />
                    ) : test.locked ? (
                      <Lock className="h-6 w-6" />
                    ) : (
                      <PlayCircle className="h-6 w-6" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <button
            type="button"
            disabled={!sessionId || totalCount === 0 || completedCount < totalCount}
            onClick={() => navigate("/system/summary")}
            className="rounded-xl bg-[#4edea3] px-16 py-5 text-xs font-semibold uppercase tracking-[0.3em] text-black shadow-2xl shadow-[#4edea3]/20 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
          >
            Finalize Assessment
          </button>
        </div>
      </div>
    </div>
  );
}

export function SystemActiveAssessmentPage() {
  useRequireSystemAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [tests, setTests] = useState<AssessmentTestData[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<number[]>([]);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [stanceMode, setStanceMode] = useState<"bilateral" | "split" | null>(null);
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flowNotice, setFlowNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOnboardingCompleted()) {
      navigate("/system/onboarding", { replace: true });
      return;
    }
    if (!isGoalConfirmed()) {
      navigate("/system/goals", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;

    const loadPage = async () => {
      setIsLoading(true);
      setLoadError(null);
      setFlowNotice(null);
      try {
        const activeSessionId = readAssessmentSessionId();
        if (!activeSessionId) {
          throw new Error("No active assessment session. Please start from Assessment Intro.");
        }
        const remoteTests = orderAssessmentTests(await fetchAssessmentTestList(activeSessionId));
        if (cancelled) return;
        if (remoteTests.length === 0) {
          throw new Error("No assessment tests are available for this session.");
        }

        const storedCompleted = readCompletedTestIds();
        const firstPendingIndex = remoteTests.findIndex(
          (item) => !storedCompleted.includes(item.id)
        );
        const fallbackIndex =
          firstPendingIndex === -1 ? Math.max(0, remoteTests.length - 1) : firstPendingIndex;

        const query = new URLSearchParams(location.search);
        const requestedTestId = Number(query.get("testId"));
        const requestedIndex = remoteTests.findIndex((item) => item.id === requestedTestId);
        const requestedFutureUnfinished =
          requestedIndex > fallbackIndex &&
          !storedCompleted.includes(remoteTests[requestedIndex]?.id ?? -1);
        let resolvedIndex = requestedIndex >= 0 ? requestedIndex : fallbackIndex;
        if (requestedFutureUnfinished) {
          resolvedIndex = fallbackIndex;
        }

        setSessionId(activeSessionId);
        setTests(remoteTests);
        setActiveIndex(resolvedIndex);
        setCompletedIds(storedCompleted);
        setSelectedScore(null);
        setStanceMode(null);
        setNote("");
        if (requestedFutureUnfinished) {
          const fallbackName = remoteTests[fallbackIndex]?.name || "current unlocked assessment test";
          setFlowNotice(`Sequence enforced: continue from ${fallbackName}.`);
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load assessment test.";
        setLoadError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadPage();
    return () => {
      cancelled = true;
    };
  }, [location.search]);

  const activeTest = tests[activeIndex];
  const activeImage = activeTest
    ? resolveAssessmentImage(activeTest.name, activeIndex)
    : fallbackAssessmentImages[0];
  const activeProtocol = activeTest ? resolveFmsProtocol(activeTest.name) : null;
  const scoreDescriptions = activeProtocol?.scoreDescriptions ?? defaultFmsScoreDescriptions;
  const compensationChecks = activeProtocol?.compensationChecks ?? defaultCompensationChecks;
  const focusCues = activeProtocol?.focusCues ?? defaultFocusCues;
  const hasPainSignal = selectedScore === 0;
  const painStatusText =
    selectedScore === null
      ? "Score Required"
      : hasPainSignal
      ? "Pain Reported (Score 0)"
      : "No Pain Flag";
  const movementVerdictText =
    selectedScore === null
      ? "Select score and stance to unlock next step."
      : selectedScore === 0
      ? "Pain present. Stop progression and shift to regression strategy."
      : selectedScore === 1
      ? "Major compensation detected. Corrective patterning is required."
      : selectedScore === 2
      ? "Usable pattern with compensation. Continue with targeted corrections."
      : "Pattern quality is strong. Progress to next test.";
  const movementVerdictTone =
    selectedScore === null
      ? "border-white/15 bg-white/5 text-zinc-300"
      : selectedScore === 0
      ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
      : selectedScore === 1
      ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
      : selectedScore === 2
      ? "border-yellow-400/30 bg-yellow-500/10 text-yellow-100"
      : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  const coachingCues = (() => {
    const category = activeTest?.category?.toLowerCase() ?? "";
    if (category === "mobility") {
      return [
        "Move slowly through the full available range without pain.",
        "Keep breathing steady and avoid compensating with the lower back.",
        "Track left-right asymmetry and note mobility restrictions."
      ];
    }
    return [
      "Maintain neutral spine and controlled tempo.",
      "Keep knees aligned and distribute pressure through the full foot.",
      "Stop immediately if sharp pain or instability appears."
    ];
  })();

  const handleSaveAndNext = async () => {
    if (isSaving || !activeTest || !sessionId) return;
    if (selectedScore === null) {
      setSaveError("Please choose a movement quality score before continuing.");
      return;
    }
    if (!stanceMode) {
      setSaveError("Please select stance orientation before continuing.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await saveAssessmentTestResult({
        testId: activeTest.id,
        score: selectedScore,
        note: [note.trim(), `stance:${stanceMode}`].filter(Boolean).join(" | ")
      });
      await saveAssessmentStep({
        sessionId,
        stepType: `test_${activeTest.id}`,
        stepStatus: 1
      }).catch(() => {
        // Keep moving even if optional step logging fails.
      });

      const nextCompleted = Array.from(new Set([...completedIds, activeTest.id]));
      setCompletedIds(nextCompleted);
      writeCompletedTestIds(nextCompleted);

      if (activeIndex + 1 < tests.length) {
        const nextTest = tests[activeIndex + 1];
        navigate(`/system/assessment-active?testId=${nextTest.id}`);
      } else {
        navigate("/system/summary");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save test result.";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100">
      {(isLoading || loadError) && (
        <div className="mx-auto max-w-4xl px-6 pt-10">
          {isLoading && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-zinc-300">
              Loading assessment test...
            </div>
          )}
          {loadError && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
              {loadError}
            </div>
          )}
        </div>
      )}
      <div className="flex min-h-[calc(100vh-72px)] flex-col lg:flex-row">
        <section className="relative min-h-[500px] w-full overflow-hidden border-r border-white/10 lg:w-3/5">
          <div className="absolute inset-0">
            <img
              src={activeImage}
              className="h-full w-full object-cover opacity-60 grayscale-[0.2]"
              alt={activeTest?.name || "Assessment test"}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
          </div>
          <div className="absolute inset-0 z-10 flex flex-col justify-between p-8 lg:p-12">
            <div className="flex flex-col gap-2">
              <span className="inline-block w-fit rounded-sm bg-[#4edea3] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-black">
                In Progress
              </span>
              <h1 className="text-5xl font-semibold uppercase tracking-tight text-[#4edea3] lg:text-7xl">
                {(activeTest?.name || "Assessment Test").toUpperCase()}
              </h1>
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-300">
                {activeTest ? formatAssessmentCategory(activeTest.category) : "Assessment"}
              </p>
              {activeTest && (
                <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-400">
                  Test {activeIndex + 1} / {tests.length}
                </p>
              )}
            </div>
            <div className="max-w-lg rounded-xl border-l-4 border-[#4edea3] bg-black/40 p-6">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#4edea3]">
                Coaching Cues
              </h3>
              <ul className="space-y-3 text-sm text-zinc-100">
                {coachingCues.map((cue) => (
                  <li key={cue} className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-[#4edea3] mt-1" />
                    <p>{cue}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="absolute left-1/3 top-1/2 z-10">
            <div className="relative">
              <div className="h-4 w-4 rounded-full bg-[#4edea3] shadow-[0_0_15px_rgba(78,222,163,0.8)]" />
              <div className="absolute left-6 top-6 h-16 w-16 border-l border-t border-[#4edea3]/40" />
              <span className="absolute left-8 top-8 whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-[#4edea3]">
                Tibia Alignment
              </span>
            </div>
          </div>
        </section>

        <section className="flex w-full flex-col gap-12 bg-[#0f0f0f] p-8 lg:w-2/5 lg:p-16">
          <div className="flex flex-col gap-6">
            <div className="flex items-end justify-between">
              <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Movement Quality Score
              </label>
              <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Objective Scale (0-3)
              </span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setSelectedScore(value);
                    setSaveError(null);
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-4 transition-all",
                    selectedScore === value
                      ? "border-[#4edea3] bg-[#4edea3]/20 text-[#4edea3]"
                      : "text-zinc-400 hover:border-[#4edea3]/40"
                  )}
                >
                  <span className="text-4xl font-semibold">{value}</span>
                  <span className="mt-2 text-[10px] uppercase tracking-[0.2em] opacity-60">
                    {scoreLabelByValue[value]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-400">FMS Scoring Rubric</p>
              {activeTest && (
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#4edea3]">
                  {activeTest.name}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {[3, 2, 1, 0].map((value) => (
                <div
                  key={value}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-3 py-2 text-xs",
                    selectedScore === value
                      ? "border-[#4edea3]/60 bg-[#4edea3]/10 text-zinc-100"
                      : "border-white/10 bg-black/30 text-zinc-300"
                  )}
                >
                  <span className="mt-0.5 text-[11px] font-semibold text-[#4edea3]">S{value}</span>
                  <span>{scoreDescriptions[value]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-10 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Stance Orientation
              </label>
              <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setStanceMode("bilateral");
                    setSaveError(null);
                  }}
                  className={cn(
                    "flex-1 rounded-lg py-3 text-[10px] uppercase tracking-[0.2em] transition-colors",
                    stanceMode === "bilateral"
                      ? "bg-white/10 text-[#4edea3]"
                      : "text-zinc-500 hover:text-white"
                  )}
                >
                  Bilateral
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStanceMode("split");
                    setSaveError(null);
                  }}
                  className={cn(
                    "flex-1 rounded-lg py-3 text-[10px] uppercase tracking-[0.2em] transition-colors",
                    stanceMode === "split"
                      ? "bg-white/10 text-[#4edea3]"
                      : "text-zinc-500 hover:text-white"
                  )}
                >
                  Split
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">Pain Status</label>
              <button
                type="button"
                className={cn(
                  "flex items-center justify-between rounded-xl px-5 py-3 text-[10px] uppercase tracking-[0.2em]",
                  selectedScore === null
                    ? "border border-white/15 bg-white/5 text-zinc-400"
                    : hasPainSignal
                    ? "border border-rose-400/30 bg-rose-400/10 text-rose-200"
                    : "border border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                )}
              >
                {painStatusText}
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    selectedScore === null
                      ? "bg-zinc-500"
                      : hasPainSignal
                      ? "bg-rose-300 animate-pulse"
                      : "bg-emerald-300"
                  )}
                />
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-400">
                Compensation Checklist
              </p>
              <ul className="mt-3 space-y-2 text-xs text-zinc-300">
                {compensationChecks.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-400">
                Corrective Focus
              </p>
              <ul className="mt-3 space-y-2 text-xs text-zinc-300">
                {focusCues.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#4edea3]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <label className="text-xs uppercase tracking-[0.2em] text-zinc-400">Clinical Notes</label>
            <div className="relative">
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="min-h-[160px] w-full rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white focus:border-[#4edea3]/40 focus:outline-none"
                placeholder="Observe ankle dorsiflexion and lumbar spine compensation..."
              />
              <div className="absolute bottom-4 right-4 flex gap-3">
                <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-zinc-400 hover:text-[#4edea3]">
                  <Mic className="h-5 w-5" />
                </button>
                <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-zinc-400 hover:text-[#4edea3]">
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div
            className={cn(
              "mt-auto flex items-center gap-3 rounded-xl border px-5 py-4 text-[12px] uppercase tracking-[0.2em]",
              movementVerdictTone
            )}
          >
            <AlertCircle className="h-5 w-5" />
            {movementVerdictText}
          </div>
          {flowNotice && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              {flowNotice}
            </div>
          )}
          {saveError && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {saveError}
            </div>
          )}
        </section>
      </div>

      <div className="fixed bottom-8 left-1/2 z-50 w-full max-w-4xl -translate-x-1/2 px-4">
        <div className="flex items-center justify-between rounded-full border border-white/10 bg-white/[0.04] px-8 py-4 shadow-2xl">
          <button
            onClick={() => navigate("/system/assessment-list")}
            className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
            Previous
          </button>
          <div className="hidden sm:flex flex-col items-center">
            <span className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Progress ({activeIndex + 1}/{tests.length || 0})
            </span>
            <div className="flex gap-1.5">
              {tests.map((test, index) => (
                <div
                  key={test.id}
                  className={cn(
                    "h-1.5 w-10 rounded-full",
                    index <= activeIndex ? "bg-[#4edea3]" : "bg-white/10"
                  )}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving || !activeTest || !sessionId || selectedScore === null || !stanceMode}
            onClick={() => {
              void handleSaveAndNext();
            }}
            className="rounded-full bg-[#4edea3] px-12 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-black shadow-xl disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving
              ? "Saving..."
              : activeIndex + 1 >= tests.length
              ? "Save & Finish"
              : "Save & Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SystemAbilityProfilePage() {
  useRequireSystemAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOnboardingCompleted()) {
      navigate("/system/onboarding", { replace: true });
      return;
    }
    if (!isGoalConfirmed()) {
      navigate("/system/goals", { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100 px-6 py-16">
      <div className="mx-auto max-w-6xl space-y-12">
        <section className="grid gap-10 md:grid-cols-2 items-center">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold text-white">Ability Profile</h2>
            <p className="mt-2 text-sm text-zinc-400">
              System-generated readiness across 6 core abilities.
            </p>
            <div className="mt-6 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="#4d4635" strokeOpacity={0.2} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#4edea3", fontSize: 10 }} />
                  <Radar dataKey="A" stroke="#4edea3" fill="#4edea3" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-[0.25em] text-[#4edea3]">Red Flags</h3>
            {riskAlerts.map((risk) => (
              <div
                key={risk.title}
                className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm"
              >
                <p className="font-semibold text-rose-200">{risk.title}</p>
                <p className="mt-2 text-zinc-300">{risk.description}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.25em] text-rose-200">
                  {risk.impact}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-[0.25em] text-zinc-400">6-Week Trend</h3>
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Auto sync</span>
          </div>
          <div className="mt-6 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <Bar dataKey="mobility" fill="#4edea3" radius={[2, 2, 0, 0]} />
                <Bar dataKey="strength" fill="#c7c6c6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="recovery" fill="#ffb4ab" radius={[2, 2, 0, 0]} />
                <Bar dataKey="power" fill="#4edea3" radius={[2, 2, 0, 0]} fillOpacity={0.5} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-[0.25em] text-[#4edea3]">
              Assessment History
            </h3>
            <button
              type="button"
              onClick={() => navigate("/system/history")}
              className="text-[10px] uppercase tracking-[0.25em] text-zinc-400 hover:text-white"
            >
              View All
            </button>
          </div>
          <div className="mt-4 space-y-3 text-sm text-zinc-300">
            {[
              { date: "Mar 29", title: "Functional Movement Screening", score: "78/100" },
              { date: "Mar 22", title: "Joint Integrity Check", score: "82/100" },
              { date: "Mar 15", title: "Mobility Diagnostic", score: "74/100" }
            ].map((item) => (
              <div
                key={item.date}
                className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/40 px-4 py-3"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{item.date}</p>
                  <p className="text-sm text-white">{item.title}</p>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-[#4edea3]">
                  {item.score}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-4 sm:flex-row">
          <button
            onClick={() => navigate("/system/summary")}
            className="flex-1 rounded-full bg-[#4edea3] px-8 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-black"
          >
            Continue to Summary
          </button>
          <button
            onClick={() => navigate("/system/assessment-list")}
            className="flex-1 rounded-full border border-white/10 px-8 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white hover:bg-white/10"
          >
            Back to Assessments
          </button>
        </div>
      </div>
    </div>
  );
}

export function SystemSummaryPage() {
  useRequireSystemAuth();
  const navigate = useNavigate();
  const [summaryData, setSummaryData] = useState<AssessmentSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOnboardingCompleted()) {
      navigate("/system/onboarding", { replace: true });
      return;
    }
    if (!isGoalConfirmed()) {
      navigate("/system/goals", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;

    const loadSummary = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const sessionId = readAssessmentSessionId();
        if (!sessionId) {
          throw new Error("No active assessment session found.");
        }
        const tests = orderAssessmentTests(await fetchAssessmentTestList(sessionId));
        const completed = readCompletedTestIds();
        const allComplete = tests.length > 0 && tests.every((test) => completed.includes(test.id));
        if (!allComplete) {
          navigate("/system/assessment-list", { replace: true });
          return;
        }
        const data = await fetchAssessmentSummary(sessionId);
        if (cancelled) return;
        setSummaryData(data);

        try {
          if (!hasSyncedAbilityProfile(sessionId)) {
            const abilityPayload = buildAbilityProfileFromSummary(data);
            if (abilityPayload) {
              await createAbilityProfile({
                userId: resolveAssessmentUserId(),
                ...abilityPayload
              });
              markAbilityProfileSynced(sessionId);
            }
          }
        } catch {
          // Keep summary page available even when profile sync fails.
        }
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Failed to load assessment summary.";
        setLoadError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const constraintItems = useMemo(() => {
    if (summaryData?.riskAlerts && summaryData.riskAlerts.length > 0) {
      return summaryData.riskAlerts.slice(0, 3).map((alert) => ({
        label: alert.joint || "Joint",
        status: alert.severity >= 3 ? "Critical" : alert.severity === 2 ? "High" : "Moderate"
      }));
    }
    if (summaryData?.jointMetrics && summaryData.jointMetrics.length > 0) {
      return summaryData.jointMetrics.slice(0, 3).map((metric) => ({
        label: metric.joint,
        status: metric.status >= 3 ? "Deficient" : metric.status === 2 ? "Watch" : "Stable"
      }));
    }
    return [
      { label: "No critical constraints", status: "Stable" }
    ];
  }, [summaryData]);

  const focusItems = useMemo(() => {
    if (!summaryData?.jointMetrics || summaryData.jointMetrics.length === 0) {
      return ["Movement consistency", "Progressive control"];
    }
    return summaryData.jointMetrics
      .slice()
      .sort((a, b) => b.status - a.status)
      .slice(0, 2)
      .map((metric) => `${metric.joint}: Mobility ${metric.mobility}, Stability ${metric.stability}`);
  }, [summaryData]);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100 px-6 py-16">
      <div className="mx-auto max-w-5xl space-y-12">
        <section className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#4edea3]/30 bg-[#4edea3]/10">
            <CheckCircle2 className="h-8 w-8 text-[#4edea3]" />
          </div>
          <h2 className="text-4xl font-semibold text-white">Assessment Complete</h2>
          <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">
            Diagnostic Data Synthesized
          </p>
          {summaryData?.summary && (
            <p className="mx-auto max-w-2xl text-sm text-zinc-300">{summaryData.summary}</p>
          )}
        </section>

        {isLoading && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-zinc-300">
            Loading assessment summary...
          </div>
        )}

        {loadError && (
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
            {loadError}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-xs uppercase tracking-[0.25em] text-[#4edea3]">
              Primary Constraints
            </h3>
            <div className="mt-4 space-y-3">
              {constraintItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl bg-black/40 p-4 text-sm"
                >
                  <span>{item.label}</span>
                  <span className="text-[#4edea3]">{item.status}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-xs uppercase tracking-[0.25em] text-[#4edea3]">
              Recommended Focus
            </h3>
            <div className="mt-4 space-y-4 text-sm text-zinc-300">
              {focusItems.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-black/40 p-4"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <button
            onClick={() => navigate("/training")}
            className="flex-1 rounded-full bg-[#4edea3] px-8 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-black"
          >
            Enter Training Hub
          </button>
          <button
            onClick={() => navigate("/")}
            className="flex-1 rounded-full border border-white/10 px-8 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white hover:bg-white/10"
          >
            Back Home
          </button>
        </div>
      </div>
    </div>
  );
}

export function SystemHistoryPage() {
  useRequireSystemAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOnboardingCompleted()) {
      navigate("/system/onboarding", { replace: true });
      return;
    }
    if (!isGoalConfirmed()) {
      navigate("/system/goals", { replace: true });
    }
  }, [navigate]);

  const historyItems = [
    { date: "Mar 29", title: "Functional Movement Screening", score: "78/100" },
    { date: "Mar 26", title: "Goal Reset", score: "Performance Cycle" },
    { date: "Mar 22", title: "Joint Integrity Check", score: "82/100" },
    { date: "Mar 15", title: "Mobility Diagnostic", score: "74/100" },
    { date: "Mar 08", title: "Stability Check", score: "79/100" }
  ];

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100 px-6 py-16">
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">System Log</p>
          <h1 className="text-4xl font-semibold text-white">System History</h1>
          <p className="text-sm text-zinc-400">
            Review assessment cycles and goal resets over time.
          </p>
        </div>

        <div className="space-y-4">
          {historyItems.map((item) => (
            <div
              key={item.date}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{item.date}</p>
                <p className="text-sm text-white">{item.title}</p>
              </div>
              <span className="text-xs uppercase tracking-[0.2em] text-[#4edea3]">
                {item.score}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <button
            onClick={() => navigate("/system/assessment")}
            className="flex-1 rounded-full bg-[#4edea3] px-8 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-black"
          >
            Start New Assessment
          </button>
          <button
            onClick={() => navigate("/system/goals")}
            className="flex-1 rounded-full border border-[#4edea3]/40 bg-[#4edea3]/10 px-8 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#4edea3] hover:bg-[#4edea3]/20"
          >
            Reset Goals
          </button>
          <button
            onClick={() => navigate("/system/profile")}
            className="flex-1 rounded-full border border-white/10 px-8 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white hover:bg-white/10"
          >
            Back to Profile
          </button>
        </div>
      </div>
    </div>
  );
}



