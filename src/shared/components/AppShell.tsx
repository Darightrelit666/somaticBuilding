import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  Bot,
  LayoutGrid,
  Loader2,
  LogIn,
  Languages,
  PlayCircle,
  Library,
  SendHorizontal,
  User,
  X,
  Dna
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useI18n } from "../i18n/I18nProvider";
import {
  AUTH_TOKEN_CHANGED_EVENT,
  AUTH_DISPLAY_NAME_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  clearAuthToken
} from "../api/auth";
import {
  isConcreteExerciseLabelCandidate,
  isGenericExercisePlaceholderName
} from "../utils/exerciseLabelSafety";
import { createCustomExercise } from "../api/exercises";
import {
  applyAssistantPlanDirect,
  chatWithAssistant,
  createAssistantContentJob,
  createAssistantSession,
  fetchAssistantContentCandidates,
  fetchAssistantContentJob,
  fetchAssistantMessages,
  fetchAssistantSession,
  generateAssistantContentPlans,
  reviewAssistantContentCandidates,
  startAssistantContentAnalyze,
  type AssistantContentCandidate,
  type AssistantContentJob,
  type AssistantContentCandidateReviewUpdate,
  type AssistantContentPlanDraft
} from "../api/assistant";
import { type WorkoutTemplateKind } from "../api/workout";
import { exercises } from "../data/exercises";

const navItems = [
  { key: "nav.home", fallback: "Home", to: "/", icon: LayoutGrid },
  { key: "nav.train", fallback: "Train", to: "/training", icon: PlayCircle },
  { key: "nav.library", fallback: "Library", to: "/systems", icon: Library },
  { key: "nav.posture", fallback: "Posture", to: "/posture", icon: Dna },
  { key: "nav.profile", fallback: "Profile", to: "/athlete", icon: User }
];

type CompanionMode = "idle" | "training";
type AssistantRouteMode = "plan" | "qa";
type PlanEntryMode = "auto" | "link" | "nl";

type CompanionChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  createTime?: string;
};

type PlanOptionCard = {
  code: string;
  title: string;
  rationale: string;
  planKind?: "course" | "module";
  requestedBlockFlow?: string[];
  sourceMode?: "source_reconstruction" | "options";
  lockToSource?: boolean;
  programWeeks?: number;
  sessionsPerWeek: number;
  sessionMinutes: number;
  previewFocus?: string;
  days?: PlanDayCard[];
  templateExercises?: PlanTemplateExercise[];
};

type PlanTemplateExercise = {
  exerciseId: number;
  name?: string;
  sets: number;
  reps: number;
  restSeconds: number;
  timeSeconds: number;
  rounds: number;
  orderIndex: number;
  blockType?: string;
  blockTitle?: string;
  groupMethod?: string;
  dayName?: string;
  note?: string;
};

type PlanBlockCard = {
  type?: string;
  title: string;
  method: string;
  items: PlanTemplateExercise[];
};

type PlanDayCard = {
  dayName: string;
  focus: string;
  intervalProtocol?: string;
  blocks: PlanBlockCard[];
};

type ContentStructureExercise = {
  exerciseId: number;
  exerciseName: string;
  sets: number;
  reps: number;
  restSeconds: number;
  timeSeconds: number;
  rounds: number;
};

type ContentStructureGroup = {
  method: string;
  rounds: number;
  exercises: ContentStructureExercise[];
};

type ContentStructureBlock = {
  title: string;
  groups: ContentStructureGroup[];
};

type ContentPlanStructure = {
  planType: "course" | "module";
  style: string;
  title: string;
  durationMin: number;
  progression: string;
  blocks: ContentStructureBlock[];
};

type PlanOptionsPayload = {
  type: "plan-options";
  language?: "zh" | "en";
  options: PlanOptionCard[];
};

type PlanScopeChoice = {
  scope: "course" | "module";
  title: string;
  description: string;
  command: string;
};

type PlanScopePayload = {
  type: "plan-scope";
  language?: "zh" | "en";
  question: string;
  choices: PlanScopeChoice[];
};

type PlanIntakeExample = {
  text: string;
};

type PlanIntakePayload = {
  type: "plan-intake";
  language?: "zh" | "en";
  question: string;
  requiredFields: string[];
  examples: PlanIntakeExample[];
};

type AnalysisReviewPayload = {
  type: "analysis-review";
  language?: "zh" | "en";
  jobId: number;
  sourcePlatform: string;
  sourceUrl: string;
  suggestedPlanType: "course" | "module";
  suggestedStyle: string;
  contentType: string;
  summary: string;
  textPreview: string;
  focusTerms: string[];
  equipmentHints: string[];
  riskFlags: string[];
  segmentClues: string[];
  visualFrameCount: number;
  visualFrames: AnalysisReviewFrame[];
  requiredMaterial: string[];
  candidateCount: number;
  unresolvedCount: number;
  candidates: AnalysisReviewCandidate[];
};

type AnalysisReviewFrame = {
  assetId: number;
  approxSec: number;
  previewUrl: string;
};

type AnalysisReviewCandidateAlternative = {
  exerciseId: number;
  exerciseName: string;
  matchScore: number;
  finalSelected: boolean;
  mappingSource: string;
};

type AnalysisReviewCandidate = {
  candidateId: number;
  label: string;
  reviewState: string;
  notes: string;
  mappedExerciseId: number;
  mappedExerciseName: string;
  matchScore: number;
  alternativeExercises: AnalysisReviewCandidateAlternative[];
};

type AnalysisReviewDraftState = {
  planType: "course" | "module";
  styleHint: string;
  candidateSelections: Record<number, number>;
};

type AssistantStructuredPayload =
  | PlanOptionsPayload
  | PlanScopePayload
  | PlanIntakePayload
  | AnalysisReviewPayload;

type ParsedAssistantPayload = {
  visibleContent: string;
  payload: AssistantStructuredPayload | null;
};

type BuilderBlockExercise = {
  uid: string;
  id: string;
  name: string;
  sets: number;
  reps: number;
  rest: number;
  time: number;
  rounds: number;
  source: "template";
};

type BuilderBlockGroup = {
  id: string;
  method: string;
  items: BuilderBlockExercise[];
};

type BuilderWorkoutBlock = {
  id: string;
  title: string;
  groups: BuilderBlockGroup[];
};

type WorkoutBuilderDraftPayload = {
  sessionName: string;
  trainingStyle: string;
  templatePoolIds: string[];
  blocks: BuilderWorkoutBlock[];
  activeBlockId: string;
  activeGroupByBlock: Record<string, string>;
  collapsedBlocks: Record<string, boolean>;
};

type QuickModuleDraftExercise = {
  exerciseId: number;
  sets: number;
  reps: number;
  restSeconds: number;
  timeSeconds: number;
  rounds: number;
  orderIndex: number;
};

type QuickModuleDraftPayload = {
  templateName: string;
  exercises: QuickModuleDraftExercise[];
};

const ASSISTANT_SESSION_STORAGE_PREFIX = "assistantSessionId_v3_";
const ASSISTANT_ROUTE_STORAGE_KEY = "assistantRouteMode";
const ASSISTANT_PLAN_ENTRY_STORAGE_KEY = "assistantPlanEntryMode";
const DEFAULT_ASSISTANT_USER_ID = 1;
const PLAN_PAYLOAD_START = "[SB_PLAN_JSON]";
const PLAN_PAYLOAD_END = "[/SB_PLAN_JSON]";
const AI_QUICK_MODULE_DRAFT_KEY = "aiQuickModuleDraft";
const DEFAULT_WORKOUT_STYLE = "Strength & Conditioning";
const DEFAULT_GROUP_METHOD = "Straight Sets";
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
const AVAILABLE_WORKOUT_STYLES = Object.keys(styleBlocksMap);
const COURSE_STYLE_BLOCK_GUIDE = Object.entries(styleBlocksMap)
  .map(([style, blocks]) => `${style}: ${blocks.join(" -> ")}`)
  .join("\n");

const exerciseImageById = new Map<number, string>(
  exercises
    .map((exercise) => ({
      id: Number(exercise.id),
      imageUrl: typeof exercise.imageUrl === "string" ? exercise.imageUrl : ""
    }))
    .filter((item) => Number.isFinite(item.id) && item.id > 0)
    .map((item) => [item.id, item.imageUrl])
);

const exerciseNameById = new Map<number, string>(
  exercises
    .map((exercise) => ({
      id: Number(exercise.id),
      name: typeof exercise.name === "string" ? exercise.name : ""
    }))
    .filter((item) => Number.isFinite(item.id) && item.id > 0 && item.name.trim().length > 0)
    .map((item) => [item.id, item.name.trim()])
);

type ExerciseLookupItem = {
  id: number;
  name: string;
  nameNorm: string;
  movementPatternNorm: string;
  equipmentNorm: string;
  abilityNorm: string;
};

const normalizeLookupText = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/[`*_~]/g, " ")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const exerciseLookupItems: ExerciseLookupItem[] = exercises
  .map((exercise) => {
    const id = Number(exercise.id);
    const name = String(exercise.name ?? "").trim();
    return {
      id,
      name,
      nameNorm: normalizeLookupText(name),
      movementPatternNorm: normalizeLookupText(String(exercise.movementPattern ?? "")),
      equipmentNorm: normalizeLookupText(String(exercise.equipmentTag ?? "")),
      abilityNorm: normalizeLookupText(String(exercise.abilityTag ?? ""))
    };
  })
  .filter((item) => Number.isFinite(item.id) && item.id > 0 && item.name.length > 0);

const resolveAssistantUserId = () => {
  if (typeof window === "undefined") return DEFAULT_ASSISTANT_USER_ID;
  const raw =
    window.localStorage.getItem("workoutActiveUserId") ||
    window.localStorage.getItem("userId");
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ASSISTANT_USER_ID;
};

const readAssistantSessionId = (userId: number, routeMode: AssistantRouteMode) => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(
    `${ASSISTANT_SESSION_STORAGE_PREFIX}${routeMode}_user_${userId}`
  );
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const writeAssistantSessionId = (
  userId: number,
  routeMode: AssistantRouteMode,
  sessionId: number
) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `${ASSISTANT_SESSION_STORAGE_PREFIX}${routeMode}_user_${userId}`,
    String(sessionId)
  );
};

const clearAssistantSessionId = (userId: number, routeMode?: AssistantRouteMode) => {
  if (typeof window === "undefined") return;
  const modes: AssistantRouteMode[] = routeMode ? [routeMode] : ["plan", "qa"];
  modes.forEach((mode) => {
    window.localStorage.removeItem(
      `${ASSISTANT_SESSION_STORAGE_PREFIX}${mode}_user_${userId}`
    );
  });
};

const resolveWorkoutUserId = () => {
  if (typeof window === "undefined") return DEFAULT_ASSISTANT_USER_ID;
  const raw =
    window.localStorage.getItem("workoutActiveUserId") ||
    window.localStorage.getItem("userId") ||
    window.localStorage.getItem("user_id");
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ASSISTANT_USER_ID;
};

const createFallbackAssistantMessage = (content: string): CompanionChatMessage => ({
  id: "welcome",
  role: "assistant",
  content
});

const isSensitiveIdentity = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return false;
  const digitsOnly = normalized.replace(/\D/g, "");
  if (/^\d{11}$/.test(digitsOnly)) return true;
  if (normalized.includes("@")) return true;
  if (/^\d{8,}$/.test(digitsOnly)) return true;
  return false;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const CONTENT_URL_REGEX = /((https?:\/\/|www\.)[^\s]+)/i;
const CONTENT_BARE_URL_REGEX =
  /(?:^|\s)((?:v\.)?douyin\.com\/[^\s]+|xhslink\.com\/[^\s]+|xhs\.cn\/[^\s]+|(?:www\.)?xiaohongshu\.com\/[^\s]+|(?:www\.)?bilibili\.com\/[^\s]+)/i;

const readTextFromRecord = (
  source: Record<string, unknown>,
  keys: string[],
  fallback = ""
) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
};

const readNumberFromRecord = (
  source: Record<string, unknown>,
  keys: string[],
  fallback = 0
) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
};

const extractFirstContentUrl = (raw: string) => {
  const directMatch = raw.match(CONTENT_URL_REGEX);
  const bareMatch = raw.match(CONTENT_BARE_URL_REGEX);
  const candidate = (directMatch?.[1] ?? bareMatch?.[1] ?? "").trim();
  if (!candidate) return "";
  const cleaned = candidate.replace(/[)\].,!?;]+$/g, "");
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://${cleaned.replace(/^\/+/, "")}`;
};

const inferPlanTypeFromInput = (raw: string): "course" | "module" => {
  const normalized = raw.trim().toLowerCase();
  if (
    /(?:^|\s)(module|quick|mini|express|短|快速|模块|小训练)(?:\s|$)/.test(normalized)
  ) {
    return "module";
  }
  return "course";
};

const hasTrainingIntent = (raw: string) => {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return false;
  if (extractFirstContentUrl(normalized)) return true;
  if (
    /(训练|训练课|模块|课程|计划|练|锻炼|体测|专项|爆发力|敏捷|耐力|速度|力量|跑步|跑|跳|跳远|立定跳远|短跑|中长跑|柔韧|稳定性|康复|module|course|plan|workout|training|speed|endurance|strength|power|agility|long jump|standing broad jump)/i.test(
      normalized
    )
  ) {
    return true;
  }
  // Chinese free-form goal sentences usually include at least one CJK char and 4+ chars.
  // Treat them as intent unless they are pure greetings (handled elsewhere).
  if (/[\u4e00-\u9fa5]/.test(normalized) && normalized.length >= 4) {
    return true;
  }
  return false;
};

const looksLikePlanNarrativeText = (raw: string) => {
  const normalized = raw.trim();
  if (!normalized) return false;
  if (detectAssistantScopeQuestion(normalized)) return false;
  const hasSectionCue =
    /(热身|主训练|放松|冷身|冷却|训练部分|块\d+|warmup|main training|cooldown|block\s*\d+)/i.test(
      normalized
    );
  const hasPrescriptionCue =
    /(组数|次数|休息|组|次|分钟|秒|sets?|reps?|rest|rounds?|amrap|tempo)/i.test(normalized);
  return hasSectionCue || hasPrescriptionCue;
};

const splitNarrativePlanOptionSections = (raw: string) => {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sections: Array<{ code: string; title: string; content: string }> = [];
  let current: { code: string; title: string; lines: string[] } | null = null;
  const optionHeadingPattern =
    /^(?:#{1,6}\s*)?(?:\*\*)?\s*(?:方案|option)\s*([A-Z0-9])\s*[：:.\-、]?\s*(.*)$/i;

  for (const line of lines) {
    const plain = sanitizePlanLineText(line).replace(/\*\*/g, "").trim();
    const match = plain.match(optionHeadingPattern);
    if (match) {
      if (current && current.lines.length > 0) {
        sections.push({
          code: current.code,
          title: current.title,
          content: current.lines.join("\n")
        });
      }
      const code = match[1]?.trim().toUpperCase() || toOptionCode(sections.length + 1);
      current = {
        code,
        title: plain,
        lines: [line]
      };
      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  if (current && current.lines.length > 0) {
    sections.push({
      code: current.code,
      title: current.title,
      content: current.lines.join("\n")
    });
  }

  return sections.filter((section) => looksLikePlanNarrativeText(section.content));
};

const isGreetingOnlyInput = (raw: string) => {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return false;
  const plain = normalized.replace(/[，。！？,.!?]/g, "").trim();
  return /^(hi|hello|hey|你好|您好|在吗|哈喽|yo|morning|good morning|晚上好)$/.test(plain);
};

const detectScopeOnlyReply = (raw: string): "course" | "module" | null => {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  if (
    /^(完整.*训练课|完整课程|完整的训练课|full course|course session|训练课|完整训练课程)$/.test(
      normalized
    )
  ) {
    return "course";
  }
  if (/^(快速模块|模块训练|quick module|module|快速训练模块)$/.test(normalized)) {
    return "module";
  }
  return null;
};

const detectScopePreferenceInText = (raw: string): "course" | "module" | null => {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  if (/(快速模块|模块训练|quick module|\bmodule\b|mini session|express)/.test(normalized)) {
    return "module";
  }
  if (
    /(完整训练课|完整课程|完整训练课程|训练课|full course|course session|full session)/.test(
      normalized
    )
  ) {
    return "course";
  }
  return null;
};

const detectAssistantScopeQuestion = (raw: string) => {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return false;
  const hasDualChoice =
    (/(full course|course session)/.test(normalized) && /(quick module|快速模块|module)/.test(normalized)) ||
    (/(完整.*训练课|完整.*课程|训练课|课程训练)/.test(normalized) &&
      /(快速模块|模块训练|quick module|module)/.test(normalized));
  const hasQuestionIntent =
    /(确认|选择|clarify|would you like|which|please|请告诉我|需要确认|before)/.test(normalized);
  return hasDualChoice && hasQuestionIntent;
};

const buildScopePayloadMessage = (language: "zh" | "en") => {
  const payload: PlanScopePayload =
    language === "zh"
      ? {
          type: "plan-scope",
          language: "zh",
          question: "请选择本次计划类型",
          choices: [
            {
              scope: "course",
              title: "完整训练课",
              description: "单次完整课程（约60-90分钟）",
              command: "完整训练课"
            },
            {
              scope: "module",
              title: "快速模块",
              description: "单次高效模块（约20-40分钟）",
              command: "快速模块"
            }
          ]
        }
      : {
          type: "plan-scope",
          language: "en",
          question: "Select plan type",
          choices: [
            {
              scope: "course",
              title: "Full Course Session",
              description: "Single complete session (60-90 min)",
              command: "full course session"
            },
            {
              scope: "module",
              title: "Quick Module",
              description: "Single focused module (20-40 min)",
              command: "quick module"
            }
          ]
        };
  return `${PLAN_PAYLOAD_START}${JSON.stringify(payload)}${PLAN_PAYLOAD_END}`;
};

const buildIntakePayloadMessage = (language: "zh" | "en") => {
  const payload: PlanIntakePayload =
    language === "zh"
      ? {
          type: "plan-intake",
          language: "zh",
          question: "请描述本次单次训练目标，或直接发送短视频链接。",
          requiredFields: ["目标", "场地/器械", "时长（可选）"],
          examples: [
            { text: "1000米专项，完整训练课，场地跑道，约70分钟" },
            { text: "踝关节稳定性，快速模块，弹力带+自重，约25分钟" }
          ]
        }
      : {
          type: "plan-intake",
          language: "en",
          question: "Describe your single-session goal, or send a short-video link.",
          requiredFields: ["goal", "equipment/environment", "duration (optional)"],
          examples: [
            { text: "1000m specific training, full course session, track, around 70 min" },
            { text: "Ankle stability quick module, band + bodyweight, around 25 min" }
          ]
        };
  return `${PLAN_PAYLOAD_START}${JSON.stringify(payload)}${PLAN_PAYLOAD_END}`;
};

const ensurePlanOptionsMinimum = (
  rawOptions: PlanOptionCard[],
  payloadLanguage: "zh" | "en"
) => {
  const options = rawOptions
    .map((option, index) => ({
      ...option,
      code: (option.code?.trim() || toOptionCode(index + 1)).toUpperCase()
    }))
    .filter((option) => option.title?.trim());
  // Keep original options only. Auto-cloning one option into A/B/C creates pseudo-diversity
  // and can hide real quality issues in upstream plan generation.
  return options;
};

const isSourceReconstructionOption = (option: PlanOptionCard) =>
  option.sourceMode === "source_reconstruction" || option.lockToSource === true;

const parseMinuteHint = (raw: string, fallback: number) => {
  const minuteMatch = raw.match(/(\d{2,3})\s*(?:分钟|min)/i);
  if (!minuteMatch) return fallback;
  const value = Number(minuteMatch[1]);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(15, Math.min(120, Math.round(value)));
};

type FallbackPhaseKey = "warmup" | "main" | "power" | "core" | "cooldown" | "generic";

const sanitizePlanLineText = (raw: string) =>
  raw
    .replace(/^[#>\-\u2022\d\.\)\s]+/, "")
    .replace(/[`*_~]/g, "")
    .trim();

const normalizeNameForCompare = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const areLikelySameExerciseName = (left: string, right: string) => {
  const a = normalizeNameForCompare(left);
  const b = normalizeNameForCompare(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aTokens = a.split(" ").filter((item) => item.length > 1);
  const bTokens = b.split(" ").filter((item) => item.length > 1);
  const overlap = aTokens.filter((token) => bTokens.includes(token)).length;
  return overlap >= 2;
};

const extractPrimaryExerciseLabel = (raw: string) => {
  const sanitized = sanitizePlanLineText(raw);
  if (!sanitized) return "";
  const leftByColon = sanitized.split(/[：:]/)[0]?.trim() ?? sanitized;
  const noBracket = leftByColon
    .replace(/\(.*?\)/g, " ")
    .replace(/（.*?）/g, " ")
    .replace(/\*.*?\*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return noBracket.slice(0, 80);
};

const isLikelyConcreteExerciseLabel = (value: string) => {
  const label = value.trim();
  if (!isConcreteExerciseLabelCandidate(label)) return false;

  const normalized = normalizeLookupText(label);
  if (!normalized) return false;
  const aliasMatched = exerciseAliasRules.some((rule) => rule.pattern.test(label));
  const catalogMatched = exerciseLookupItems.some((item) => {
    if (!item.nameNorm) return false;
    return item.nameNorm === normalized || item.nameNorm.includes(normalized) || normalized.includes(item.nameNorm);
  });
  if (aliasMatched || catalogMatched) return true;
  return true;
};

const inferFallbackPhaseFromHeading = (heading: string): FallbackPhaseKey => {
  const normalized = normalizeLookupText(heading);
  if (!normalized) return "generic";
  if (/warmup|热身|准备活动|激活/.test(normalized)) return "warmup";
  if (/cooldown|冷身|冷却|放松|恢复|拉伸/.test(normalized)) return "cooldown";
  if (/专项|爆发|增强|plyo|jump|power/.test(normalized)) return "power";
  if (/核心|core|stability/.test(normalized)) return "core";
  if (/主训练|力量|技术|main|strength/.test(normalized)) return "main";
  return "generic";
};

const inferFallbackPhaseFromLine = (line: string): FallbackPhaseKey => {
  const normalized = normalizeLookupText(line);
  if (!normalized) return "generic";
  if (/高抬腿|后踢腿|跳绳|动态拉伸|warmup/.test(normalized)) return "warmup";
  if (/平板|侧桥|仰卧举腿|core|plank/.test(normalized)) return "core";
  if (/拉伸|呼吸|冷身|cooldown|stretch/.test(normalized)) return "cooldown";
  if (/跳远|箱跳|纵跳|深蹲跳|爆发|jump|plyo/.test(normalized)) return "power";
  if (/深蹲|弓步|力量|技术|strength|lunge|squat/.test(normalized)) return "main";
  return "generic";
};

const fallbackBlockTitleByPhase: Record<FallbackPhaseKey, { zh: string; en: string }> = {
  warmup: { zh: "热身与激活", en: "Warmup & Activation" },
  main: { zh: "技术与力量", en: "Technique & Strength" },
  power: { zh: "专项爆发", en: "Specific Power" },
  core: { zh: "核心稳定", en: "Core Stability" },
  cooldown: { zh: "放松恢复", en: "Cooldown & Recovery" },
  generic: { zh: "训练内容", en: "Training Block" }
};

const fallbackMethodByPhase: Record<FallbackPhaseKey, string> = {
  warmup: "Circuit",
  main: "Straight Sets",
  power: "Straight Sets",
  core: "Circuit",
  cooldown: "Circuit",
  generic: "Straight Sets"
};

type PlanOptionVariant = {
  key: "technique_strength" | "volume_control" | "power_density";
  zh: string;
  en: string;
  zhDescription: string;
  enDescription: string;
};

const PLAN_OPTION_VARIANTS: PlanOptionVariant[] = [
  {
    key: "technique_strength",
    zh: "技术力量",
    en: "Technique Strength",
    zhDescription: "强调动作质量、主项力量和足够休息，适合作为稳妥基础方案。",
    enDescription: "Prioritizes movement quality, primary strength work, and fuller rest."
  },
  {
    key: "volume_control",
    zh: "容量控制",
    en: "Volume Control",
    zhDescription: "强调中等负荷、更多训练容量和肌肉控制，适合塑形或稳态提升。",
    enDescription: "Uses moderate load, higher volume, and controlled tempo for robust adaptation."
  },
  {
    key: "power_density",
    zh: "爆发密度",
    en: "Power Density",
    zhDescription: "强调爆发输出、密度训练和短休息，适合提升运动表现与体能。",
    enDescription: "Emphasizes explosive intent, density, and shorter rests for performance."
  }
];

const optionIndexFromCode = (code: string) => {
  const normalized = code.trim().toUpperCase();
  if (/^[A-Z]$/.test(normalized)) {
    return normalized.charCodeAt(0) - "A".charCodeAt(0);
  }
  const numeric = Number.parseInt(normalized, 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric - 1 : 0;
};

const resolvePlanOptionVariant = (option: Pick<PlanOptionCard, "code">, fallbackIndex = 0) => {
  const indexFromCode = option.code ? optionIndexFromCode(option.code) : fallbackIndex;
  const index = Number.isFinite(indexFromCode) && indexFromCode >= 0 ? indexFromCode : fallbackIndex;
  return PLAN_OPTION_VARIANTS[index % PLAN_OPTION_VARIANTS.length];
};

const normalizeCourseBlockKey = (raw: string) => {
  const normalized = normalizeLookupText(raw);
  if (!normalized) return "";
  if (/warmup|warm up|热身|准备活动/.test(normalized)) return "warmup";
  if (/assessment|screen|评估|筛查/.test(normalized)) return "assessment";
  if (/activation|激活/.test(normalized)) return "activation";
  if (/movement prep|movement preparation|动作准备|准备/.test(normalized)) return "movementprep";
  if (/breathing|breath|呼吸/.test(normalized)) return "breathing";
  if (/speed|sprint|速度|冲刺/.test(normalized)) return "speed";
  if (/agility|敏捷|变向/.test(normalized)) return "agility";
  if (/power|plyo|explosive|爆发|增强/.test(normalized)) return "power";
  if (/skill|technique|技术|技巧/.test(normalized)) return "skill";
  if (/compound|复合|主项/.test(normalized)) return "compound";
  if (/secondary|次要|辅助主项/.test(normalized)) return "secondary";
  if (/isolation|孤立|单关节/.test(normalized)) return "isolation";
  if (/pump|泵感|充血/.test(normalized)) return "pump";
  if (/accessory|assistant|辅助/.test(normalized)) return "accessory";
  if (/corrective|纠正|矫正/.test(normalized)) return "corrective";
  if (/strength|力量/.test(normalized)) return "strength";
  if (/conditioning|metcon|体能|有氧|燃脂/.test(normalized)) return "conditioning";
  if (/finisher|收尾/.test(normalized)) return "finisher";
  if (/wod/.test(normalized)) return "wod";
  if (/circuit|循环/.test(normalized)) return "circuit";
  if (/mobility|活动度|灵活/.test(normalized)) return "mobility";
  if (/flow|流动|串联/.test(normalized)) return "flow";
  if (/stretch|拉伸/.test(normalized)) return "stretch";
  if (/cooldown|cool down|冷身|冷却|放松恢复/.test(normalized)) return "cooldown";
  if (/relax|恢复|放松/.test(normalized)) return "relax";
  if (/main training|main work|main set|main block|主训练|主体训练|训练主体|主要训练/.test(normalized)) {
    return "main";
  }
  return normalized.replace(/\s+/g, "");
};

const detectRequestedCourseStageFlow = (raw: string) => {
  const source = raw.trim();
  if (!source) return [];
  const normalized = source.toLowerCase();
  const explicitStageLanguage =
    /(包含|包括|分为|分成|阶段安排|阶段包括|训练阶段|include|including|contains|consists of|split into)/i.test(
      source
    );
  if (!explicitStageLanguage) return [];
  const hasWarmup = /(热身|准备活动|warm\s*-?\s*up|warmup)/i.test(source);
  let hasMain =
    /(主训练|主体训练|训练主体|主要训练|main\s+training|main\s+work|main\s+set|main\s+block)/i.test(
      source
    ) ||
    (explicitStageLanguage && /(力量部分|训练部分|strength\s+block|strength\s+part)/i.test(source));
  const hasCooldown = /(冷身|冷却|放松|cool\s*-?\s*down|cooldown|recovery|stretching)/i.test(source);
  if (hasWarmup && hasCooldown && !hasMain) {
    hasMain = true;
  }
  const count = [hasWarmup, hasMain, hasCooldown].filter(Boolean).length;
  if (count < 2) return [];
  const flow: string[] = [];
  if (hasWarmup) flow.push("Warmup");
  if (hasMain) flow.push(normalized.includes("strength block") ? "Strength" : "Main Training");
  if (hasCooldown) flow.push("Cooldown");
  return flow;
};

const getExpectedCourseBlockFlow = (
  option: PlanOptionCard,
  contextText = ""
): { blocks: string[]; explicit: boolean } => {
  if (option.planKind === "module") return { blocks: [], explicit: false };
  const requestedFromContext = detectRequestedCourseStageFlow(contextText);
  const requestedFromOption =
    Array.isArray(option.requestedBlockFlow) && option.requestedBlockFlow.length > 0
      ? option.requestedBlockFlow.filter((item) => item.trim())
      : detectRequestedCourseStageFlow(
          [option.title, option.rationale, option.previewFocus].filter(Boolean).join(" ")
        );
  const requested = requestedFromContext.length > 0 ? requestedFromContext : requestedFromOption;
  if (requested.length > 0) {
    return { blocks: requested, explicit: true };
  }
  const style = inferWorkoutStyleFromOption(option);
  return { blocks: styleBlocksMap[style] ?? styleBlocksMap[DEFAULT_WORKOUT_STYLE], explicit: false };
};

const isBlockLikelyMainWork = (blockTitle: string) => {
  const key = normalizeCourseBlockKey(blockTitle);
  if (!key) return false;
  if (["warmup", "cooldown", "relax", "stretch", "breathing", "mobility", "flow"].includes(key)) {
    return false;
  }
  return true;
};

const doesCourseBlockMatch = (actualTitle: string, expectedTitle: string, explicitFlow: boolean) => {
  const actualKey = normalizeCourseBlockKey(actualTitle);
  const expectedKey = normalizeCourseBlockKey(expectedTitle);
  if (!actualKey || !expectedKey) return false;
  if (actualKey === expectedKey) return true;
  if (expectedKey === "main" && explicitFlow && isBlockLikelyMainWork(actualTitle)) return true;
  if (expectedKey === "cooldown" && ["stretch", "relax"].includes(actualKey)) return true;
  if (expectedKey === "relax" && ["cooldown", "stretch"].includes(actualKey)) return true;
  if (expectedKey === "strength" && actualKey === "main") return true;
  return false;
};

const groupMethodForCourseBlock = (blockTitle: string) => {
  const key = normalizeCourseBlockKey(blockTitle);
  if (["conditioning", "finisher", "wod", "circuit"].includes(key)) return "Circuit";
  if (["pump", "isolation"].includes(key)) return "Superset";
  if (["mobility", "flow", "stretch", "relax", "breathing", "cooldown"].includes(key)) return "Flow";
  return "Straight Sets";
};

const defaultMetricsForCourseBlock = (
  blockTitle: string,
  variant: PlanOptionVariant = PLAN_OPTION_VARIANTS[0]
) => {
  const key = normalizeCourseBlockKey(blockTitle);
  if (["warmup", "activation", "movementprep", "corrective", "assessment"].includes(key)) {
    if (variant.key === "power_density") {
      return { sets: 2, reps: 6, restSeconds: 20, timeSeconds: 20, rounds: 1 };
    }
    return { sets: 2, reps: variant.key === "volume_control" ? 12 : 8, restSeconds: 30, timeSeconds: 0, rounds: 1 };
  }
  if (["speed", "agility", "power", "skill"].includes(key)) {
    if (variant.key === "volume_control") {
      return { sets: 3, reps: 6, restSeconds: 75, timeSeconds: 0, rounds: 1 };
    }
    return { sets: variant.key === "power_density" ? 5 : 4, reps: 3, restSeconds: 90, timeSeconds: 0, rounds: 1 };
  }
  if (["strength", "compound", "main"].includes(key)) {
    if (variant.key === "volume_control") {
      return { sets: 4, reps: 10, restSeconds: 75, timeSeconds: 0, rounds: 1 };
    }
    if (variant.key === "power_density") {
      return { sets: 3, reps: 5, restSeconds: 90, timeSeconds: 0, rounds: 1 };
    }
    return { sets: 4, reps: 5, restSeconds: 120, timeSeconds: 0, rounds: 1 };
  }
  if (["secondary", "accessory", "isolation", "pump"].includes(key)) {
    if (variant.key === "volume_control") {
      return { sets: 3, reps: 12, restSeconds: 45, timeSeconds: 0, rounds: 1 };
    }
    if (variant.key === "power_density") {
      return { sets: 2, reps: 8, restSeconds: 45, timeSeconds: 0, rounds: 1 };
    }
    return { sets: 3, reps: 8, restSeconds: 75, timeSeconds: 0, rounds: 1 };
  }
  if (["conditioning", "finisher", "wod", "circuit"].includes(key)) {
    if (variant.key === "technique_strength") {
      return { sets: 1, reps: 0, restSeconds: 60, timeSeconds: 30, rounds: 2 };
    }
    if (variant.key === "volume_control") {
      return { sets: 1, reps: 0, restSeconds: 45, timeSeconds: 40, rounds: 3 };
    }
    return { sets: 1, reps: 0, restSeconds: 30, timeSeconds: 30, rounds: 4 };
  }
  if (["breathing", "mobility", "flow"].includes(key)) {
    return { sets: 2, reps: variant.key === "volume_control" ? 8 : 6, restSeconds: 20, timeSeconds: 30, rounds: 1 };
  }
  if (["stretch", "relax", "cooldown"].includes(key)) {
    return { sets: 1, reps: 0, restSeconds: 20, timeSeconds: variant.key === "power_density" ? 60 : 50, rounds: 1 };
  }
  return { sets: 3, reps: 8, restSeconds: 60, timeSeconds: 0, rounds: 1 };
};

const fallbackExerciseNamesForCourseBlock = (
  blockTitle: string,
  style: string,
  focusText: string,
  variant: PlanOptionVariant = PLAN_OPTION_VARIANTS[0]
) => {
  const key = normalizeCourseBlockKey(blockTitle);
  const normalizedFocus = normalizeLookupText(focusText);
  const upperFocus = /(上肢|胸|背|肩|卧推|引体|upper|bench|pull|press|shoulder|chest|back)/.test(
    normalizedFocus
  );
  const lowerFocus = /(下肢|腿|髋|膝|踝|深蹲|硬拉|lower|leg|squat|deadlift|ankle|knee|hip)/.test(
    normalizedFocus
  );
  const upperStrength =
    variant.key === "volume_control"
      ? ["Incline Dumbbell Press", "Seated Cable Row", "Dumbbell Lateral Raise"]
      : variant.key === "power_density"
      ? ["Push Press", "Explosive Pull-Up", "Med Ball Slam"]
      : ["Barbell Bench Press", "Pull-Up", "Dumbbell Shoulder Press"];
  const lowerStrength =
    variant.key === "volume_control"
      ? ["Bulgarian Split Squat", "Hip Thrust", "Leg Curl"]
      : variant.key === "power_density"
      ? ["Trap Bar Jump", "Kettlebell Swing", "Broad Jump"]
      : ["Goblet Squat", "Romanian Deadlift", "Split Squat"];
  const generalStrength =
    variant.key === "volume_control"
      ? ["Dumbbell Goblet Squat", "Incline Push-Up", "Chest-Supported Row"]
      : variant.key === "power_density"
      ? ["Squat Jump", "Push Press", "Kettlebell Swing"]
      : ["Goblet Squat", "Push-Up", "One-Arm Dumbbell Row"];
  if (key === "warmup") {
    if (variant.key === "power_density") return ["Jump Rope", upperFocus ? "Scapular Push-Up" : "A-Skip Drill"];
    if (variant.key === "volume_control") return ["Dynamic Mobility Flow", upperFocus ? "Band Pull-Apart" : "Glute Bridge"];
    return ["Dynamic Mobility Flow", upperFocus ? "Band External Rotation" : "World's Greatest Stretch"];
  }
  if (key === "assessment") return ["Overhead Squat Assessment"];
  if (key === "activation") {
    if (variant.key === "power_density") return [upperFocus ? "Med Ball Chest Pass Prep" : "Pogo Hop", "Dead Bug"];
    return [upperFocus ? "Band External Rotation" : "Glute Bridge", variant.key === "volume_control" ? "Side Plank" : "Dead Bug"];
  }
  if (key === "movementprep") {
    if (variant.key === "power_density") return ["A-Skip Drill", lowerFocus ? "Lateral Bound" : "Inchworm Walkout"];
    return ["World's Greatest Stretch", lowerFocus ? "Lateral Lunge" : "Inchworm Walkout"];
  }
  if (key === "breathing") return ["Crocodile Breathing"];
  if (key === "speed") return variant.key === "volume_control" ? ["Tempo Run Drill", "Wall Sprint Drill"] : ["A-Skip Drill", "Wall Sprint Drill"];
  if (key === "agility") return variant.key === "power_density" ? ["Lateral Bound", "Deceleration Lunge"] : ["Lateral Shuffle", "Deceleration Lunge"];
  if (key === "power") {
    if (variant.key === "volume_control") return [upperFocus ? "Landmine Press" : "Kettlebell Swing", "Jump Landing"];
    return [upperFocus ? "Med Ball Chest Pass" : "Squat Jump", variant.key === "power_density" ? "Broad Jump" : "Jump Landing"];
  }
  if (key === "skill") return ["Jump Rope Footwork", "Hollow Hold"];
  if (key === "compound" || key === "strength" || key === "main") {
    return upperFocus ? upperStrength : lowerFocus ? lowerStrength : generalStrength;
  }
  if (key === "secondary") {
    if (variant.key === "volume_control") return upperFocus ? ["Seated Cable Row", "Dumbbell Floor Press"] : ["Bulgarian Split Squat", "Hip Thrust"];
    if (variant.key === "power_density") return upperFocus ? ["Push Press", "Explosive Pull-Up"] : ["Kettlebell Swing", "Reverse Lunge"];
    return upperFocus ? ["One-Arm Dumbbell Row", "Push-Up"] : ["Reverse Lunge", "Hip Thrust"];
  }
  if (key === "accessory") {
    if (variant.key === "volume_control") return upperFocus ? ["Cable Face Pull", "Dumbbell Lateral Raise"] : ["Step-Up", "Hamstring Curl"];
    return upperFocus ? ["Face Pull", "Lateral Raise"] : ["Step-Up", "Calf Raise"];
  }
  if (key === "isolation") return upperFocus ? ["Lateral Raise", "Cable Triceps Pressdown"] : ["Hamstring Curl", "Calf Raise"];
  if (key === "pump") {
    if (variant.key === "volume_control") return upperFocus ? ["Dumbbell Fly", "Band Pull-Apart"] : ["Bodyweight Squat", "Glute Bridge"];
    return upperFocus ? ["Push-Up", "Band Pull-Apart"] : ["Bodyweight Squat", "Glute Bridge"];
  }
  if (key === "corrective") return lowerFocus ? ["Ankle CAR", "Terminal Knee Extension"] : ["Wall Slide", "Dead Bug"];
  if (key === "conditioning" || key === "finisher" || key === "wod" || key === "circuit") {
    if (style === "Athletic") {
      return variant.key === "power_density"
        ? ["Shuttle Sprint", "Lateral Bound", "Farmer Carry"]
        : ["Shuttle Run", "Mountain Climber", "Farmer Carry"];
    }
    if (variant.key === "technique_strength") return ["Farmer Carry", "Mountain Climber", "Jump Rope"];
    if (variant.key === "volume_control") return ["Kettlebell Swing", "Step-Up", "Battle Rope Wave"];
    return ["Burpee", "Mountain Climber", "Kettlebell Swing"];
  }
  if (key === "mobility") {
    if (variant.key === "volume_control") return lowerFocus ? ["Hip 90/90 Switch", "Ankle Mobility Drill"] : ["Shoulder CAR", "Wall Slide"];
    return lowerFocus ? ["Ankle Mobility Drill", "Hip CAR"] : ["Shoulder CAR", "Thoracic Rotation"];
  }
  if (key === "flow") return variant.key === "power_density" ? ["Animal Flow Beast Reach", "World's Greatest Stretch"] : ["Cat-Cow Flow", "World's Greatest Stretch"];
  if (key === "stretch" || key === "relax" || key === "cooldown") {
    if (variant.key === "power_density") return upperFocus ? ["Lat Stretch", "Box Breathing"] : ["Hip Flexor Stretch", "Box Breathing"];
    return upperFocus ? ["Chest Stretch", "Lat Stretch"] : ["Hip Flexor Stretch", "Thoracic Rotation"];
  }
  return ["Push-Up", "Bodyweight Squat"];
};

const maxOptionOrderIndex = (option: PlanOptionCard) => {
  const rows = [
    ...(option.templateExercises ?? []),
    ...((option.days ?? []).flatMap((day) => day.blocks.flatMap((block) => block.items)) ?? [])
  ];
  return rows.reduce((max, row) => Math.max(max, Number(row.orderIndex) || 0), 0);
};

const dedupeBlockItems = (items: PlanTemplateExercise[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const nameKey = normalizeLookupText(String(item.name ?? ""));
    const key = item.exerciseId > 0 ? `id:${item.exerciseId}` : nameKey ? `name:${nameKey}` : "";
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const createFallbackCourseBlock = (
  blockTitle: string,
  option: PlanOptionCard,
  orderStart: number,
  language?: "zh" | "en",
  variant: PlanOptionVariant = resolvePlanOptionVariant(option)
) => {
  const style = inferWorkoutStyleFromOption(option);
  const focusText = [option.title, option.rationale, option.previewFocus].filter(Boolean).join(" ");
  const method = groupMethodForCourseBlock(blockTitle);
  const metrics = defaultMetricsForCourseBlock(blockTitle, variant);
  const names = fallbackExerciseNamesForCourseBlock(blockTitle, style, focusText, variant);
  const itemCount = ["cooldown", "relax", "stretch", "breathing", "assessment"].includes(
    normalizeCourseBlockKey(blockTitle)
  )
    ? 1
    : Math.min(2, names.length);
  const items: PlanTemplateExercise[] = names.slice(0, itemCount).map((name, index) => ({
    exerciseId: 0,
    name,
    sets: metrics.sets,
    reps: metrics.reps,
    restSeconds: metrics.restSeconds,
    timeSeconds: metrics.timeSeconds,
    rounds: metrics.rounds,
    orderIndex: orderStart + index,
    blockType: blockTitle,
    blockTitle,
    groupMethod: method,
    note:
      language === "zh"
        ? "自动补齐缺失阶段，保存/打开时会创建动作库条目。"
        : "Auto-filled missing stage; opening/saving will create a library entry."
  }));
  return {
    type: blockTitle,
    title: blockTitle,
    method,
    items
  } as PlanBlockCard;
};

const methodForVariantBlock = (
  blockTitle: string,
  existingMethod: string,
  variant: PlanOptionVariant
) => {
  const key = normalizeCourseBlockKey(blockTitle);
  if (["warmup", "activation", "movementprep"].includes(key)) return "Circuit";
  if (["breathing", "mobility", "flow", "stretch", "relax", "cooldown"].includes(key)) return "Flow";
  if (variant.key === "volume_control" && ["secondary", "accessory", "isolation", "pump"].includes(key)) {
    return "Superset";
  }
  if (variant.key === "power_density" && ["conditioning", "finisher", "wod", "circuit"].includes(key)) {
    return "Interval";
  }
  if (["conditioning", "finisher", "wod", "circuit"].includes(key)) return "Circuit";
  return existingMethod?.trim() || "Straight Sets";
};

const applyVariantMetricsToExercise = (
  exercise: PlanTemplateExercise,
  blockTitle: string,
  variant: PlanOptionVariant
): PlanTemplateExercise => {
  const key = normalizeCourseBlockKey(blockTitle || exercise.blockTitle || exercise.blockType || "");
  const metrics = defaultMetricsForCourseBlock(blockTitle || exercise.blockTitle || "", variant);
  const next: PlanTemplateExercise = {
    ...exercise,
    sets: metrics.sets,
    reps: metrics.reps,
    restSeconds: metrics.restSeconds,
    timeSeconds: metrics.timeSeconds,
    rounds: metrics.rounds
  };

  if (["warmup", "activation", "movementprep", "assessment"].includes(key)) {
    next.sets = Math.max(1, metrics.sets);
    next.reps = metrics.reps;
    next.restSeconds = metrics.restSeconds;
    next.timeSeconds = exercise.timeSeconds > 0 && variant.key !== "power_density" ? exercise.timeSeconds : metrics.timeSeconds;
  } else if (["speed", "agility", "power", "skill"].includes(key)) {
    next.sets = metrics.sets;
    next.reps = metrics.reps;
    next.restSeconds = metrics.restSeconds;
  } else if (["strength", "compound", "main"].includes(key)) {
    next.sets = metrics.sets;
    next.reps = metrics.reps;
    next.restSeconds = metrics.restSeconds;
    next.timeSeconds = 0;
  } else if (["secondary", "accessory", "isolation", "pump"].includes(key)) {
    next.sets = metrics.sets;
    next.reps = metrics.reps;
    next.restSeconds = metrics.restSeconds;
    next.timeSeconds = 0;
  } else if (["conditioning", "finisher", "wod", "circuit"].includes(key)) {
    next.sets = 1;
    next.reps = exercise.reps > 0 && variant.key !== "power_density" ? Math.min(exercise.reps, 12) : metrics.reps;
    next.restSeconds = metrics.restSeconds;
    next.timeSeconds = metrics.timeSeconds;
    next.rounds = metrics.rounds;
  } else if (["breathing", "mobility", "flow", "stretch", "relax", "cooldown"].includes(key)) {
    next.sets = metrics.sets;
    next.reps = metrics.reps;
    next.restSeconds = metrics.restSeconds;
    next.timeSeconds = metrics.timeSeconds;
    next.rounds = 1;
  }

  return next;
};

const labelPlanOptionVariant = (variant: PlanOptionVariant, language?: "zh" | "en") =>
  language === "zh" ? variant.zh : variant.en;

const describePlanOptionVariant = (variant: PlanOptionVariant, language?: "zh" | "en") =>
  language === "zh" ? variant.zhDescription : variant.enDescription;

const differentiatePlanOption = (
  option: PlanOptionCard,
  language?: "zh" | "en",
  optionIndex = 0
): PlanOptionCard => {
  const variant = resolvePlanOptionVariant(option, optionIndex);
  const variantLabel = labelPlanOptionVariant(variant, language);
  const variantDescription = describePlanOptionVariant(variant, language);
  const titleHasVariant =
    option.title.includes(variant.zh) || option.title.toLowerCase().includes(variant.en.toLowerCase());
  const title = titleHasVariant ? option.title : `${option.title} · ${variantLabel}`;
  const currentRationale = option.rationale?.trim() || "";
  const rationaleHasVariant =
    currentRationale.startsWith(`${variant.zh}:`) ||
    currentRationale.toLowerCase().startsWith(`${variant.en.toLowerCase()}:`);
  const rationale = currentRationale
    ? rationaleHasVariant
      ? currentRationale
      : `${variantLabel}: ${variantDescription}\n${currentRationale}`
    : `${variantLabel}: ${variantDescription}`;
  const currentPreview = option.previewFocus?.trim() || "";
  const previewHasVariant =
    currentPreview.startsWith(`${variant.zh} ·`) ||
    currentPreview.toLowerCase().startsWith(`${variant.en.toLowerCase()} ·`);
  const previewFocus = currentPreview
    ? previewHasVariant
      ? currentPreview
      : `${variantLabel} · ${currentPreview}`
    : `${variantLabel} · ${variantDescription}`;

  let nextOrder = 1;
  const transformedDays = (option.days ?? []).map((day) => ({
    ...day,
    focus: (() => {
      const currentFocus = day.focus?.trim() || "";
      if (!currentFocus) return variantDescription;
      if (
        currentFocus.startsWith(`${variant.zh} ·`) ||
        currentFocus.toLowerCase().startsWith(`${variant.en.toLowerCase()} ·`)
      ) {
        return currentFocus;
      }
      return `${variantLabel} · ${currentFocus}`;
    })(),
    blocks: day.blocks.map((block) => {
      const method = methodForVariantBlock(block.title, block.method, variant);
      return {
        ...block,
        method,
        items: block.items.map((item) => ({
          ...applyVariantMetricsToExercise(item, block.title, variant),
          orderIndex: nextOrder++,
          blockTitle: block.title,
          blockType: block.type || block.title,
          groupMethod: method
        }))
      };
    })
  }));

  const transformedTemplateExercises =
    transformedDays.length > 0
      ? transformedDays.flatMap((day) => day.blocks.flatMap((block) => block.items))
      : (option.templateExercises ?? []).map((item) => {
          const blockTitle = item.blockTitle?.trim() || item.blockType?.trim() || "Training Block";
          const method = methodForVariantBlock(blockTitle, item.groupMethod || "", variant);
          return {
            ...applyVariantMetricsToExercise(item, blockTitle, variant),
            orderIndex: nextOrder++,
            blockTitle,
            blockType: item.blockType || blockTitle,
            groupMethod: method
          };
        });

  return {
    ...option,
    title,
    rationale,
    previewFocus,
    templateExercises: transformedTemplateExercises,
    days: transformedDays.length > 0 ? transformedDays : option.days
  };
};

const ensureCompleteCourseOption = (
  option: PlanOptionCard,
  language?: "zh" | "en",
  contextText = "",
  optionIndex = 0
): PlanOptionCard => {
  if (option.planKind === "module") return option;
  const expected = getExpectedCourseBlockFlow(option, contextText);
  if (expected.blocks.length === 0) return option;
  const variant = resolvePlanOptionVariant(option, optionIndex);

  const sourceBlocks =
    (option.days ?? []).flatMap((day) => day.blocks).filter((block) => block.items.length > 0) ??
    [];
  const templateOnlyBlocks =
    sourceBlocks.length > 0
      ? []
      : (option.templateExercises ?? []).reduce<PlanBlockCard[]>((blocks, exercise) => {
          if (!hasUsableExerciseRef(exercise)) return blocks;
          const title = exercise.blockTitle?.trim() || "Main Training";
          const existing = blocks.find((block) => block.title === title);
          const row = { ...exercise, blockTitle: title, blockType: exercise.blockType || title };
          if (existing) {
            existing.items.push(row);
          } else {
            blocks.push({
              type: title,
              title,
              method: exercise.groupMethod || groupMethodForCourseBlock(title),
              items: [row]
            });
          }
          return blocks;
        }, []);

  const existingBlocks = [...sourceBlocks, ...templateOnlyBlocks].map((block) => ({
    ...block,
    items: dedupeBlockItems(block.items)
  }));
  const used = new Set<number>();
  let nextOrder = maxOptionOrderIndex(option) + 1;
  const repairedBlocks: PlanBlockCard[] = [];

  expected.blocks.forEach((expectedTitle) => {
    const matchingBlocks = existingBlocks.filter((block, index) => {
      if (used.has(index)) return false;
      return doesCourseBlockMatch(block.title, expectedTitle, expected.explicit);
    });

    matchingBlocks.forEach((_, index) => {
      const sourceIndex = existingBlocks.findIndex(
        (block, candidateIndex) =>
          !used.has(candidateIndex) &&
          block === matchingBlocks[index]
      );
      if (sourceIndex >= 0) used.add(sourceIndex);
    });

    const mergedItems = matchingBlocks.flatMap((block) => block.items);
    if (mergedItems.length > 0) {
      repairedBlocks.push({
        type: expectedTitle,
        title: expectedTitle,
        method: matchingBlocks[0]?.method || groupMethodForCourseBlock(expectedTitle),
        items: mergedItems.map((item) => ({
          ...item,
          blockTitle: expectedTitle,
          blockType: expectedTitle,
          groupMethod: item.groupMethod || matchingBlocks[0]?.method || groupMethodForCourseBlock(expectedTitle)
        }))
      });
      return;
    }

    const fallbackBlock = createFallbackCourseBlock(expectedTitle, option, nextOrder, language, variant);
    nextOrder += fallbackBlock.items.length;
    repairedBlocks.push(fallbackBlock);
  });

  if (!expected.explicit) {
    existingBlocks.forEach((block, index) => {
      if (!used.has(index) && block.items.length > 0) {
        repairedBlocks.push(block);
      }
    });
  }

  let orderIndex = 1;
  const normalizedBlocks = repairedBlocks
    .map((block) => ({
      ...block,
      items: dedupeBlockItems(block.items).map((item) => ({
        ...item,
        orderIndex: orderIndex++,
        blockTitle: block.title,
        blockType: block.type || block.title,
        groupMethod: item.groupMethod || block.method
      }))
    }))
    .filter((block) => block.items.length > 0);
  const templateExercises = normalizedBlocks.flatMap((block) => block.items);

  return {
    ...option,
    requestedBlockFlow: expected.explicit ? expected.blocks : option.requestedBlockFlow,
    templateExercises,
    days: [
      {
        dayName: option.days?.[0]?.dayName || (language === "zh" ? "训练日 1" : "Session Day 1"),
        focus:
          option.days?.[0]?.focus ||
          option.previewFocus ||
          (language === "zh" ? "单次训练安排" : "Single-session training"),
        intervalProtocol: option.days?.[0]?.intervalProtocol,
        blocks: normalizedBlocks
      }
    ]
  };
};

type ExerciseAliasRule = {
  pattern: RegExp;
  queries: string[];
  phase?: FallbackPhaseKey;
};

const exerciseAliasRules: ExerciseAliasRule[] = [
  { pattern: /(动态拉伸|dynamic stretch)/i, queries: ["dynamic stretch", "mobility flow"], phase: "warmup" },
  { pattern: /(肩部绕圈|肩绕环|arm circle|shoulder circle)/i, queries: ["arm circles"], phase: "warmup" },
  { pattern: /(手臂摆动|arm swing)/i, queries: ["arm swings"], phase: "warmup" },
  { pattern: /(弹力带外旋|外旋|band external rotation)/i, queries: ["band external rotation"], phase: "warmup" },
  { pattern: /(胸部拉伸|chest stretch)/i, queries: ["chest stretch"], phase: "cooldown" },
  { pattern: /(肩部拉伸|shoulder stretch)/i, queries: ["shoulder stretch"], phase: "cooldown" },
  { pattern: /(肱三头肌拉伸|triceps stretch)/i, queries: ["triceps stretch"], phase: "cooldown" },
  { pattern: /(杠铃卧推|卧推|barbell bench press|bench press)/i, queries: ["barbell bench press", "bench press"], phase: "main" },
  { pattern: /(哑铃肩推|dumbbell shoulder press|shoulder press)/i, queries: ["dumbbell shoulder press", "shoulder press"], phase: "main" },
  { pattern: /(引体向上|pull up|pull-up|chin up|chin-up)/i, queries: ["pull up", "chin up"], phase: "main" },
  { pattern: /(高位下拉|lat pulldown|lat pull down)/i, queries: ["lat pulldown"], phase: "main" },
  { pattern: /(单臂哑铃划船|单臂划船|one arm dumbbell row|one-arm dumbbell row)/i, queries: ["one arm dumbbell row", "dumbbell row"], phase: "main" },
  { pattern: /(俯卧撑|push up|push-up)/i, queries: ["push up", "push-up"], phase: "main" },
  { pattern: /(面拉|face pull)/i, queries: ["face pull"], phase: "main" },
  { pattern: /(高抬腿|high knee)/i, queries: ["high knee", "knee raise"], phase: "warmup" },
  { pattern: /(后踢腿|butt kick)/i, queries: ["butt kick"], phase: "warmup" },
  { pattern: /(侧向跨步|侧步|side step|lateral step)/i, queries: ["side lunge", "lateral lunge"], phase: "warmup" },
  { pattern: /(弓步转体|lunge twist)/i, queries: ["walking lunge", "lunge"], phase: "warmup" },
  { pattern: /(跳绳|rope)/i, queries: ["jump rope", "rope jump"], phase: "warmup" },
  { pattern: /(单脚跳|single leg hop|single leg jump)/i, queries: ["single leg jump", "single leg hop"], phase: "warmup" },
  { pattern: /(纵跳|vertical jump)/i, queries: ["jump squat", "box jump"], phase: "power" },
  { pattern: /(深蹲跳|squat jump)/i, queries: ["squat jump", "jump squat"], phase: "power" },
  { pattern: /(箱跳|box jump|台阶跳)/i, queries: ["box jump"], phase: "power" },
  { pattern: /(立定跳远|broad jump|long jump)/i, queries: ["broad jump", "jump"], phase: "power" },
  { pattern: /(平板支撑|plank)/i, queries: ["plank"], phase: "core" },
  { pattern: /(侧桥|side plank)/i, queries: ["side plank"], phase: "core" },
  { pattern: /(仰卧举腿|leg raise)/i, queries: ["lying leg raise", "leg raise"], phase: "core" },
  { pattern: /(弓步|lunge)/i, queries: ["walking lunge", "lunge"], phase: "main" },
  { pattern: /(股四头|quadriceps|quad)/i, queries: ["quad stretch", "quadriceps stretch"], phase: "cooldown" },
  { pattern: /(腘绳肌|hamstring)/i, queries: ["hamstring stretch", "hamstring"], phase: "cooldown" },
  { pattern: /(小腿|calf)/i, queries: ["calf stretch", "calf raise"], phase: "cooldown" },
  { pattern: /(臀部|glute)/i, queries: ["glute bridge", "glute stretch"], phase: "cooldown" }
];

const scoreLookupCandidate = (
  candidate: ExerciseLookupItem,
  queryNorm: string,
  phase: FallbackPhaseKey
) => {
  if (!queryNorm) return 0;
  let lexicalScore = 0;
  const queryTokens = queryNorm.split(" ").filter(Boolean);
  const nameTokens = candidate.nameNorm.split(" ").filter(Boolean);
  if (candidate.nameNorm === queryNorm) lexicalScore += 160;
  else if (candidate.nameNorm.includes(queryNorm) || queryNorm.includes(candidate.nameNorm)) {
    lexicalScore += 120;
  }
  for (const token of queryTokens) {
    if (token.length < 2) continue;
    if (candidate.nameNorm.includes(token)) lexicalScore += 18;
    if (nameTokens.includes(token)) lexicalScore += 12;
  }

  // Phase/equipment hints are only tie-breakers after the name has actually matched.
  // Without this guard, any warmup/stretch row can incorrectly become 90/90 Hamstring.
  if (lexicalScore <= 0) return 0;

  let score = lexicalScore;
  if (phase === "warmup" && /stretch|cardio/.test(candidate.movementPatternNorm)) score += 12;
  if (phase === "cooldown" && /stretch/.test(candidate.movementPatternNorm)) score += 18;
  if (phase === "power" && /strength|cardio/.test(candidate.movementPatternNorm)) score += 8;
  if (phase === "core" && /strength/.test(candidate.movementPatternNorm)) score += 8;
  if (/bodyweight/.test(candidate.equipmentNorm)) score += 6;
  return score;
};

const resolveExerciseFromText = (label: string, phase: FallbackPhaseKey) => {
  const normalized = normalizeLookupText(label);
  if (!isLikelyConcreteExerciseLabel(label)) {
    return { exerciseId: 0, name: "" };
  }
  if (!normalized || exerciseLookupItems.length === 0) {
    return { exerciseId: 0, name: label.trim() || "Exercise" };
  }

  const aliasMatched = exerciseAliasRules.find((rule) => rule.pattern.test(label));
  const queryPool = aliasMatched ? aliasMatched.queries : [normalized];
  const scopedPhase = aliasMatched?.phase ?? phase;

  let best: ExerciseLookupItem | null = null;
  let bestScore = 0;
  for (const query of queryPool) {
    const queryNorm = normalizeLookupText(query);
    for (const candidate of exerciseLookupItems) {
      const score = scoreLookupCandidate(candidate, queryNorm, scopedPhase);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
  }

  if (!best || bestScore < 30) {
    return {
      exerciseId: 0,
      name: label.trim() || "Exercise"
    };
  }

  return {
    exerciseId: best.id,
    name: best.name
  };
};

const hasUsableExerciseRef = (item: Pick<PlanTemplateExercise, "exerciseId" | "name">) => {
  const name = String(item.name ?? "").trim();
  return item.exerciseId > 0 || (Boolean(name) && isLikelyConcreteExerciseLabel(name));
};

const inferPrimaryMuscleFromLabel = (label: string) => {
  const normalized = normalizeLookupText(label);
  if (/(squat|lunge|leg|quad|深蹲|弓步|腿)/i.test(normalized)) return "Quadriceps";
  if (/(deadlift|hinge|hamstring|硬拉|髋铰链|腘绳肌)/i.test(normalized)) return "Hamstrings";
  if (/(push|press|bench|chest|俯卧撑|卧推|胸)/i.test(normalized)) return "Chest";
  if (/(row|pull|lat|pullup|引体|划船|背)/i.test(normalized)) return "Lats";
  if (/(plank|core|abs|sit[- ]?up|卷腹|核心)/i.test(normalized)) return "Abdominals";
  if (/(run|jump|cardio|有氧|跳|跑)/i.test(normalized)) return "Calves";
  return "General";
};

const inferEquipmentFromLabel = (label: string) => {
  const normalized = normalizeLookupText(label);
  if (/barbell|杠铃/.test(normalized)) return "Barbell";
  if (/dumbbell|哑铃/.test(normalized)) return "Dumbbell";
  if (/kettlebell|壶铃/.test(normalized)) return "Kettlebells";
  if (/cable|绳索/.test(normalized)) return "Cable";
  if (/machine|器械/.test(normalized)) return "Machine";
  if (/band|弹力带/.test(normalized)) return "Bands";
  return "Bodyweight";
};

const buildFallbackPlanOptionsFromPlainText = (
  raw: string,
  payloadLanguage: "zh" | "en"
): PlanOptionsPayload | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Do not synthesize plan cards for pure scope-confirmation prompts.
  // But normal plan text often contains "完整训练课/快速模块" in titles, which must still be parsed.
  if (detectAssistantScopeQuestion(trimmed)) {
    return null;
  }
  const sectionAnchors = /(热身|主训练|冷身|冷却|cooldown|warmup|main training|main set|strength)/i;
  if (!sectionAnchors.test(trimmed)) return null;

  const narrativeSections = splitNarrativePlanOptionSections(trimmed);
  if (narrativeSections.length >= 2) {
    const sectionOptions = narrativeSections
      .map((section, index) => {
        const sectionPayload = buildFallbackPlanOptionsFromPlainText(
          section.content,
          payloadLanguage
        );
        const option = sectionPayload?.options?.[0];
        if (!option) return null;
        const cleanSectionTitle =
          section.title.replace(/[#`*_~]/g, "").replace(/\s+/g, " ").trim() ||
          option.title;
        return {
          ...option,
          code: (section.code || toOptionCode(index + 1)).toUpperCase(),
          title: cleanSectionTitle,
          previewFocus: option.previewFocus || cleanSectionTitle
        } as PlanOptionCard;
      })
      .filter((option): option is PlanOptionCard => Boolean(option));

    if (sectionOptions.length > 0) {
      return {
        type: "plan-options",
        language: payloadLanguage,
        options: sectionOptions
      };
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks: PlanBlockCard[] = [];
  let orderIndex = 1;
  let currentPhase: FallbackPhaseKey = "generic";
  let currentBlockIndex = -1;
  let lastExerciseRow: PlanTemplateExercise | null = null;

  const ensureBlock = (phase: FallbackPhaseKey, heading?: string) => {
    const localizedTitle = fallbackBlockTitleByPhase[phase][payloadLanguage === "zh" ? "zh" : "en"];
    const titleText =
      heading?.replace(/[`*_~]/g, "").replace(/\s+/g, " ").trim() || localizedTitle;
    const existingIndex = blocks.findIndex(
      (block) => normalizeLookupText(block.title) === normalizeLookupText(titleText)
    );
    if (existingIndex >= 0) {
      currentBlockIndex = existingIndex;
      currentPhase = phase;
      return blocks[existingIndex];
    }
    const block: PlanBlockCard = {
      type: titleText,
      title: titleText,
      method: fallbackMethodByPhase[phase],
      items: []
    };
    blocks.push(block);
    currentBlockIndex = blocks.length - 1;
    currentPhase = phase;
    return block;
  };

  const isDecorativeLine = (line: string) => /^[-=]{3,}$/.test(line.trim());

  for (const line of lines) {
    if (isDecorativeLine(line)) continue;
    const cleaned = sanitizePlanLineText(line);
    if (!cleaned) continue;
    const plain = cleaned.replace(/\*\*/g, "").trim();
    if (!plain) continue;

    const headingPhase = inferFallbackPhaseFromHeading(plain);
    const hasHeadingCue = /(阶段|phase|热身|主训练|专项|核心|放松|冷身|恢复|warmup|cooldown|main)/i.test(plain);
    const looksLikeSubHeading =
      plain.length <= 22 &&
      /(激活|拉伸|技术|力量|强化|模拟|辅助|基础|练习|训练|block|drill)/i.test(plain);
    const hasWorkMetric = /(\d+\s*(?:次|组|秒|分钟|min|reps?|sets?|rounds?))|([x×]\s*\d+)/i.test(plain);
    const looksLikeSectionHeading =
      hasHeadingCue &&
      plain.length <= 40 &&
      !/[：:]\s*[^：:]+(?:组|次|reps?|sets?|rest|休息)/i.test(plain);
    if (looksLikeSectionHeading || (looksLikeSubHeading && !hasWorkMetric)) {
      ensureBlock(headingPhase, plain);
      continue;
    }

    const phaseFromLine = inferFallbackPhaseFromLine(plain);
    const targetPhase =
      currentBlockIndex >= 0 && currentPhase !== "generic"
        ? phaseFromLine === "generic"
          ? currentPhase
          : phaseFromLine
        : phaseFromLine;
    const activePhase = targetPhase === "generic" ? currentPhase : targetPhase;
    if (currentBlockIndex < 0 || (activePhase !== currentPhase && targetPhase !== "generic")) {
      ensureBlock(activePhase);
    }
    const block = currentBlockIndex >= 0 ? blocks[currentBlockIndex] : ensureBlock(activePhase);

    const tryUpdateLastExerciseByMetricLine = () => {
      if (!lastExerciseRow) return false;
      if (/(提示|注意|note|cue)/i.test(plain)) return true;
      const setRepGroupFirst = plain.match(
        /(\d+)\s*(?:组|sets?)\s*[x×*]\s*(\d+)(?:\s*[-~～至]\s*(\d+))?\s*(?:次|reps?)/i
      );
      const setRepRepsFirst = plain.match(
        /(\d+)(?:\s*[-~～至]\s*(\d+))?\s*(?:次|reps?)\s*[x×*]\s*(\d+)\s*(?:组|sets?)/i
      );
      const setsOnly =
        plain.match(/(?:组数|sets?)\s*[:：]?\s*(\d+)/i) ??
        plain.match(/(\d+)\s*(?:组|sets?)/i);
      const repsOnly =
        plain.match(/(?:次数|reps?)\s*[:：]?\s*(\d+)(?:\s*[-~～至]\s*(\d+))?/i) ??
        plain.match(/(\d+)(?:\s*[-~～至]\s*(\d+))?\s*(?:次|reps?)/i);
      const restOnly =
        plain.match(/(?:休息|rest)\s*[:：]?\s*(\d+)\s*(?:秒|s|sec|seconds)/i) ??
        plain.match(/(?:休息|rest)\s*[:：]?\s*(\d+)\s*(?:分钟|min)/i);
      const timeOnly =
        plain.match(/(?:时间|时长|work|持续)\s*[:：]?\s*(\d+)\s*(?:秒|s|sec|seconds)/i) ??
        plain.match(/(?:时间|时长|work|持续)\s*[:：]?\s*(\d+)\s*(?:分钟|min)/i);
      const roundsOnly = plain.match(/(?:轮数|rounds?|rnd)\s*[:：]?\s*(\d+)/i);
      const hasMetric = Boolean(
        setRepGroupFirst ||
          setRepRepsFirst ||
          setsOnly ||
          repsOnly ||
          restOnly ||
          timeOnly ||
          roundsOnly
      );
      if (!hasMetric) return false;

      if (setRepGroupFirst) {
        const setsValue = Number(setRepGroupFirst[1]);
        const repsA = Number(setRepGroupFirst[2]);
        const repsB = Number(setRepGroupFirst[3] ?? setRepGroupFirst[2]);
        const repsValue =
          Number.isFinite(repsA) && Number.isFinite(repsB)
            ? Math.round((repsA + repsB) / 2)
            : repsA;
        if (Number.isFinite(setsValue) && setsValue > 0) lastExerciseRow.sets = Math.round(setsValue);
        if (Number.isFinite(repsValue) && repsValue >= 0) lastExerciseRow.reps = Math.round(repsValue);
      } else if (setRepRepsFirst) {
        const repsA = Number(setRepRepsFirst[1]);
        const repsB = Number(setRepRepsFirst[2] ?? setRepRepsFirst[1]);
        const setsValue = Number(setRepRepsFirst[3]);
        const repsValue =
          Number.isFinite(repsA) && Number.isFinite(repsB)
            ? Math.round((repsA + repsB) / 2)
            : repsA;
        if (Number.isFinite(setsValue) && setsValue > 0) lastExerciseRow.sets = Math.round(setsValue);
        if (Number.isFinite(repsValue) && repsValue >= 0) lastExerciseRow.reps = Math.round(repsValue);
      } else if (setsOnly) {
        const v = Number(setsOnly[1]);
        if (Number.isFinite(v) && v > 0) lastExerciseRow.sets = Math.round(v);
      }
      if (!setRepGroupFirst && !setRepRepsFirst && repsOnly) {
        const a = Number(repsOnly[1]);
        const b = Number(repsOnly[2] ?? repsOnly[1]);
        const pick = Number.isFinite(a) && Number.isFinite(b) ? Math.round((a + b) / 2) : a;
        if (Number.isFinite(pick) && pick >= 0) lastExerciseRow.reps = Math.round(pick);
      }
      if (restOnly) {
        const v = Number(restOnly[1]);
        const isMinute = /分钟|min/i.test(restOnly[0]);
        const rest = isMinute ? v * 60 : v;
        if (Number.isFinite(rest) && rest >= 0) lastExerciseRow.restSeconds = Math.round(rest);
      }
      if (timeOnly) {
        const v = Number(timeOnly[1]);
        const isMinute = /分钟|min/i.test(timeOnly[0]);
        const sec = isMinute ? v * 60 : v;
        if (Number.isFinite(sec) && sec >= 0) lastExerciseRow.timeSeconds = Math.round(sec);
      }
      if (roundsOnly) {
        const v = Number(roundsOnly[1]);
        if (Number.isFinite(v) && v > 0) lastExerciseRow.rounds = Math.round(v);
      }
      return true;
    };
    if (tryUpdateLastExerciseByMetricLine()) {
      continue;
    }

    const label = extractPrimaryExerciseLabel(plain);
    if (!label) continue;
    if (/^\d+\s*(?:组|sets?|次|reps?|秒|分钟|min|s|sec|seconds)/i.test(label)) continue;
    if (/^(注意|强调|说明|选择|建议|每组间休息|记录|分析|提示|组数|次数|休息|时间|时长|轮数|动作|目标|结构|训练结构|训练节奏|进阶|恢复|负荷)/.test(label)) continue;
    if (!isLikelyConcreteExerciseLabel(label)) continue;

    const pairMatch = plain.match(/(\d+)\s*(?:次|reps?)\s*[x×]\s*(\d+)\s*(?:组|sets?)/i);
    const sets = pairMatch
      ? Number(pairMatch[2])
      : Number((plain.match(/(\d+)\s*(?:组|sets?)/i) ?? [])[1] ?? 3);
    const reps = pairMatch
      ? Number(pairMatch[1])
      : Number((plain.match(/(\d+)\s*(?:次|reps?)/i) ?? [])[1] ?? 8);
    const restMatch =
      plain.match(/(?:休息|rest)\s*(\d+)\s*(?:秒|s|sec|seconds)/i) ??
      plain.match(/(?:休息|rest)\s*(\d+)\s*(?:分钟|min)/i);
    const restSeconds = restMatch
      ? plain.includes("分钟")
        ? Number(restMatch[1]) * 60
        : Number(restMatch[1])
      : 60;
    const timeMinutes = Number((plain.match(/(\d+)\s*(?:分钟|min)/i) ?? [])[1] ?? 0);
    const rounds = Number((plain.match(/(\d+)\s*(?:轮|rounds?)/i) ?? [])[1] ?? 1);
    const matched = resolveExerciseFromText(label, activePhase);

    block.items.push({
      exerciseId: matched.exerciseId,
      name: matched.name,
      sets: Number.isFinite(sets) && sets > 0 ? sets : 3,
      reps: Number.isFinite(reps) && reps >= 0 ? reps : 8,
      restSeconds: Number.isFinite(restSeconds) && restSeconds >= 0 ? restSeconds : 60,
      timeSeconds: Number.isFinite(timeMinutes) && timeMinutes > 0 ? timeMinutes * 60 : 0,
      rounds: Number.isFinite(rounds) && rounds > 0 ? rounds : 1,
      orderIndex,
      blockTitle: block.title,
      blockType: block.type,
      groupMethod: block.method
    });
    lastExerciseRow = block.items[block.items.length - 1] ?? null;
    orderIndex += 1;
  }

  const compactBlocks = blocks.filter((block) => block.items.length > 0);
  compactBlocks.forEach((block) => {
    block.items = block.items.filter((item) => hasUsableExerciseRef(item));
  });
  const effectiveBlocks = compactBlocks.filter((block) => block.items.length > 0);
  if (effectiveBlocks.length === 0) return null;

  const defaultPlanKind: "course" | "module" = /模块|quick module/i.test(trimmed)
    ? "module"
    : "course";
  const inferredStyle =
    inferStyleHintFromInput(trimmed) ||
    (/(跳远|爆发|纵跳|短跑|敏捷|jump|power|speed)/i.test(trimmed)
      ? "Athletic"
      : DEFAULT_WORKOUT_STYLE);
  const templateExercises = effectiveBlocks.flatMap((block) => block.items);
  if (templateExercises.length === 0) return null;
  const sessionMinutes = parseMinuteHint(trimmed, defaultPlanKind === "module" ? 30 : 70);
  const planTitleSeed =
    lines.find((line) => /计划|训练课|module|session/i.test(line)) ??
    (payloadLanguage === "zh" ? "训练方案" : "Training Plan");

  return {
    type: "plan-options",
    language: payloadLanguage,
    options: [
      {
        code: "A",
        title: `${planTitleSeed.replace(/[#`*_~]/g, "").trim()} · ${inferredStyle}`,
        rationale:
          payloadLanguage === "zh"
            ? "依据对话文本自动完成分块与动作库匹配，可继续微调。"
            : "Auto-structured from plain text with exercise-library matching. Further refinements are supported.",
        planKind: defaultPlanKind,
        sourceMode: undefined,
        lockToSource: false,
        sessionsPerWeek: 1,
        sessionMinutes,
        previewFocus: lines[0] ?? "",
        templateExercises,
        days: [
          {
            dayName: payloadLanguage === "zh" ? "训练日 1" : "Session Day 1",
            focus: payloadLanguage === "zh" ? "单次训练安排" : "Single-session training",
            blocks: effectiveBlocks
          }
        ]
      }
    ]
  };
};


const inferStyleHintFromInput = (raw: string) => {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return "";
  if (/(bodybuilding|hypertrophy|aesthetic|增肌|塑形|肌肥大)/.test(normalized)) {
    return "Bodybuilding";
  }
  if (/(crossfit|wod|metcon|交叉训练)/.test(normalized)) {
    return "CrossFit";
  }
  if (/(functional|stability|ankle|knee|功能性|稳定性|踝|膝)/.test(normalized)) {
    return "Functional";
  }
  if (/(mobility|yoga|stretch|活动度|灵活|瑜伽|拉伸)/.test(normalized)) {
    return "Mobility / Yoga";
  }
  if (/(athletic|speed|agility|sports|竞技|速度|敏捷|jump|broad jump|long jump|跳远|爆发)/.test(normalized)) {
    return "Athletic";
  }
  if (/(rehab|injury|recovery|康复|伤病|恢复)/.test(normalized)) {
    return "Rehab";
  }
  if (/(conditioning|fat loss|cardio|有氧|燃脂|体能)/.test(normalized)) {
    return "Strength & Conditioning";
  }
  return "";
};

const normalizeGroupMethodFromContentType = (groupType: string) => {
  const normalized = groupType.trim().toLowerCase();
  if (normalized.includes("superset")) return "Superset";
  if (normalized.includes("circuit")) return "Circuit";
  if (normalized.includes("interval")) return "Interval";
  if (normalized.includes("hiit")) return "HIIT";
  return "Straight Sets";
};

const toOptionCode = (index: number) => {
  const codes = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index >= 1 && index <= codes.length) {
    return codes[index - 1];
  }
  return String(Math.max(1, index));
};

const parseContentPlanStructure = (
  raw: unknown,
  fallbackPlanType: "course" | "module",
  fallbackStyle: string,
  fallbackTitle: string
): ContentPlanStructure => {
  const structure = isRecord(raw) ? raw : {};
  const rawPlanType = readTextFromRecord(structure, ["plan_type", "planType"], fallbackPlanType)
    .toLowerCase();
  const planType: "course" | "module" = rawPlanType === "module" ? "module" : "course";
  const style =
    readTextFromRecord(structure, ["style"], fallbackStyle || DEFAULT_WORKOUT_STYLE) ||
    DEFAULT_WORKOUT_STYLE;
  const title =
    readTextFromRecord(structure, ["title"], fallbackTitle || "AI Content Plan") ||
    "AI Content Plan";
  const durationMin = Math.max(
    1,
    Math.round(readNumberFromRecord(structure, ["duration_min", "durationMin"], planType === "module" ? 25 : 45))
  );
  const progression = readTextFromRecord(structure, ["progression"], "");

  const blocksRaw = Array.isArray(structure.blocks) ? structure.blocks : [];
  const blocks: ContentStructureBlock[] = blocksRaw
    .map((rawBlock, blockIndex) => {
      const block = isRecord(rawBlock) ? rawBlock : {};
      const titleValue =
        readTextFromRecord(block, ["block_name", "blockName", "title", "name"], `Block ${blockIndex + 1}`) ||
        `Block ${blockIndex + 1}`;
      const groupsRaw = Array.isArray(block.groups) ? block.groups : [];
      const groups: ContentStructureGroup[] = groupsRaw
        .map((rawGroup) => {
          const group = isRecord(rawGroup) ? rawGroup : {};
          const method = normalizeGroupMethodFromContentType(
            readTextFromRecord(group, ["group_type", "groupType"], "straight_sets")
          );
          const rounds = Math.max(
            1,
            Math.round(readNumberFromRecord(group, ["rounds"], 1))
          );
          const groupRest = Math.max(
            0,
            Math.round(readNumberFromRecord(group, ["rest_seconds", "restSeconds"], 0))
          );
          const exercisesRaw = Array.isArray(group.exercises) ? group.exercises : [];
          const exercises: ContentStructureExercise[] = exercisesRaw
            .map((rawExercise) => {
              const exercise = isRecord(rawExercise) ? rawExercise : {};
              const exerciseId = Math.round(
                readNumberFromRecord(exercise, ["exercise_id", "exerciseId"], 0)
              );
              if (!Number.isFinite(exerciseId) || exerciseId <= 0) return null;
              const exerciseName =
                readTextFromRecord(exercise, ["exercise_name", "exerciseName", "name"], "") ||
                `ID ${exerciseId}`;
              return {
                exerciseId,
                exerciseName,
                sets: Math.max(1, Math.round(readNumberFromRecord(exercise, ["sets"], 3))),
                reps: Math.max(0, Math.round(readNumberFromRecord(exercise, ["reps"], 8))),
                restSeconds: Math.max(
                  0,
                  Math.round(readNumberFromRecord(exercise, ["rest_seconds", "restSeconds"], groupRest))
                ),
                timeSeconds: Math.max(
                  0,
                  Math.round(readNumberFromRecord(exercise, ["time_seconds", "timeSeconds"], 0))
                ),
                rounds: Math.max(
                  1,
                  Math.round(readNumberFromRecord(exercise, ["rounds", "rnd"], rounds))
                )
              };
            })
            .filter((item): item is ContentStructureExercise => Boolean(item));
          if (exercises.length === 0) return null;
          return {
            method,
            rounds,
            exercises
          };
        })
        .filter((group): group is ContentStructureGroup => Boolean(group));
      if (groups.length === 0) return null;
      return {
        title: titleValue,
        groups
      };
    })
    .filter((block): block is ContentStructureBlock => Boolean(block));

  return {
    planType,
    style,
    title,
    durationMin,
    progression,
    blocks
  };
};

const buildPlanOptionsPayloadFromContentPlans = (
  plans: AssistantContentPlanDraft[],
  payloadLanguage: "zh" | "en",
  sourceMode?: PlanOptionCard["sourceMode"]
): PlanOptionsPayload => {
  const options: PlanOptionCard[] = plans.map((plan, index) => {
    const parsed = parseContentPlanStructure(
      plan.structure,
      plan.planType,
      plan.style,
      plan.title
    );
    let orderIndex = 1;
    const dayBlocks: PlanBlockCard[] = [];
    const templateExercises: PlanTemplateExercise[] = [];
    for (const block of parsed.blocks) {
      for (const group of block.groups) {
        const items: PlanTemplateExercise[] = group.exercises.map((exercise) => {
          const row: PlanTemplateExercise = {
            exerciseId: exercise.exerciseId,
            name: exercise.exerciseName,
            sets: exercise.sets,
            reps: exercise.reps,
            restSeconds: exercise.restSeconds,
            timeSeconds: exercise.timeSeconds,
            rounds: exercise.rounds,
            orderIndex,
            blockType: block.title,
            blockTitle: block.title,
            groupMethod: group.method
          };
          orderIndex += 1;
          return row;
        });
        dayBlocks.push({
          type: block.title,
          title: block.title,
          method: group.method,
          items
        });
        templateExercises.push(...items);
      }
    }

    const dayName = payloadLanguage === "zh" ? "训练日 1" : "Session Day 1";
    const focusFallback =
      payloadLanguage === "zh" ? "基于视频内容解析生成" : "Generated from source video analysis";

    return {
      code: toOptionCode(plan.optionIndex > 0 ? plan.optionIndex : index + 1),
      title: parsed.title || plan.title || `Option ${index + 1}`,
      rationale: plan.summary || focusFallback,
      planKind: parsed.planType,
      sourceMode,
      lockToSource: sourceMode === "source_reconstruction",
      // AI Builder outputs a single training session design.
      // Weekly programming belongs to Program Planner, not this plan card.
      programWeeks: 0,
      sessionsPerWeek: 1,
      sessionMinutes: parsed.durationMin,
      previewFocus: parsed.progression || plan.summary || focusFallback,
      templateExercises,
      days: [
        {
          dayName,
          focus: plan.summary || focusFallback,
          blocks: dayBlocks
        }
      ]
    };
  });

  return {
    type: "plan-options",
    language: payloadLanguage,
    options
  };
};

const toTextArray = (node: unknown) => {
  if (!Array.isArray(node)) return [];
  return node
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizePlanTypeValue = (raw: string): "course" | "module" =>
  raw.trim().toLowerCase() === "module" ? "module" : "course";

const normalizeAnalysisReviewCandidates = (
  candidates: AssistantContentCandidate[]
): AnalysisReviewCandidate[] =>
  candidates
    .map((candidate) => {
      const alternatives = candidate.alternativeExercises
        .map((option) => ({
          exerciseId: option.exerciseId,
          exerciseName: option.exerciseName.trim(),
          matchScore: Number.isFinite(option.matchScore) ? Math.max(0, option.matchScore) : 0,
          finalSelected: Boolean(option.finalSelected),
          mappingSource: option.mappingSource.trim()
        }))
        .filter((option) => option.exerciseId > 0 && option.exerciseName);

      const mappedExerciseId = candidate.mappedExerciseId > 0 ? candidate.mappedExerciseId : 0;
      const mappedExerciseName = candidate.mappedExerciseName.trim();
      const existsInAlternatives = alternatives.some(
        (option) => option.exerciseId === mappedExerciseId
      );
      if (mappedExerciseId > 0 && mappedExerciseName && !existsInAlternatives) {
        alternatives.unshift({
          exerciseId: mappedExerciseId,
          exerciseName: mappedExerciseName,
          matchScore:
            Number.isFinite(candidate.matchScore) && candidate.matchScore > 0
              ? candidate.matchScore
              : 0,
          finalSelected: true,
          mappingSource: "selected"
        });
      }

      return {
        candidateId: candidate.candidateId,
        label: candidate.rawLabel.trim() || candidate.normalizedLabel.trim(),
        reviewState: candidate.reviewState.trim(),
        notes: candidate.notes.trim(),
        mappedExerciseId,
        mappedExerciseName,
        matchScore:
          Number.isFinite(candidate.matchScore) && candidate.matchScore > 0
            ? candidate.matchScore
            : 0,
        alternativeExercises: alternatives
      };
    })
    .filter((candidate) => candidate.candidateId > 0 && candidate.label);

const buildAnalysisReviewPayloadFromJob = (
  job: AssistantContentJob,
  candidates: AssistantContentCandidate[],
  payloadLanguage: "zh" | "en",
  fallbackPlanType: "course" | "module",
  fallbackStyle: string,
  fallbackSourceUrl: string
): AnalysisReviewPayload => {
  const analysis = job.analysisResult;
  const suggestedPlanType = analysis?.planTypeHint ?? fallbackPlanType;
  const suggestedStyle =
    analysis?.styleHint?.trim() || fallbackStyle.trim() || DEFAULT_WORKOUT_STYLE;
  const summary =
    analysis?.summary?.trim() ||
    job.resultSummary?.trim() ||
    (payloadLanguage === "zh"
      ? "链接解析完成，请先确认训练类型、风格与候选动作；确认后只生成一个视频训练计划。"
      : "Link analysis completed. Confirm plan type, style, and candidate movements; then generate one source video plan.");
  const normalizedCandidates = normalizeAnalysisReviewCandidates(candidates);
  const unresolvedCount = normalizedCandidates.filter((item) => {
    const state = item.reviewState.toLowerCase();
    if (state === "needs_review" || state === "pending") return true;
    if (item.mappedExerciseId <= 0 && item.alternativeExercises.length <= 0) return true;
    return false;
  }).length;

  return {
    type: "analysis-review",
    language: payloadLanguage,
    jobId: job.jobId,
    sourcePlatform: job.sourcePlatform || "unknown",
    sourceUrl: job.sourceUrl || fallbackSourceUrl,
    suggestedPlanType,
    suggestedStyle,
    contentType: analysis?.contentType?.trim() || "",
    summary,
    textPreview: analysis?.textPreview?.trim() || "",
    focusTerms: toTextArray(analysis?.focusTerms),
    equipmentHints: toTextArray(analysis?.equipmentHints),
    riskFlags: toTextArray(analysis?.riskFlags),
    segmentClues: toTextArray(analysis?.segmentClues),
    visualFrameCount: Math.max(0, analysis?.visualFrameCount ?? 0),
    visualFrames: analysis?.visualFrames ?? [],
    requiredMaterial: job.requiredMaterial,
    candidateCount: Math.max(
      normalizedCandidates.length,
      Math.max(0, job.candidateCount)
    ),
    unresolvedCount,
    candidates: normalizedCandidates
  };
};

const parseAssistantStructuredPayload = (content: string): ParsedAssistantPayload => {
  const start = content.indexOf(PLAN_PAYLOAD_START);
  const end = content.indexOf(PLAN_PAYLOAD_END);
  if (start < 0 || end < 0 || end <= start) {
    return {
      visibleContent: content,
      payload: null
    };
  }

  const visibleContent = `${content.slice(0, start)}${content.slice(end + PLAN_PAYLOAD_END.length)}`.trim();
  const rawJson = content
    .slice(start + PLAN_PAYLOAD_START.length, end)
    .trim();

  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (!isRecord(parsed)) {
      return {
        visibleContent,
        payload: null
      };
    }

    if (parsed.type === "plan-scope" && Array.isArray(parsed.choices)) {
      const choices: PlanScopeChoice[] = parsed.choices
        .map((item) => (isRecord(item) ? item : {}))
        .map((record) => ({
          scope: record.scope === "module" ? "module" : "course",
          title: typeof record.title === "string" ? record.title.trim() : "",
          description: typeof record.description === "string" ? record.description.trim() : "",
          command: typeof record.command === "string" ? record.command.trim() : ""
        }))
        .filter((choice) => choice.title && choice.command);

      return {
        visibleContent,
        payload: {
          type: "plan-scope",
          language: parsed.language === "zh" ? "zh" : "en",
          question: typeof parsed.question === "string" ? parsed.question.trim() : "",
          choices
        }
      };
    }

    if (parsed.type === "plan-intake") {
      const requiredFields = Array.isArray(parsed.requiredFields)
        ? parsed.requiredFields
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

      const examples: PlanIntakeExample[] = Array.isArray(parsed.examples)
        ? parsed.examples
            .map((item) => (isRecord(item) ? item : {}))
            .map((record) => ({
              text: typeof record.text === "string" ? record.text.trim() : ""
            }))
            .filter((item) => item.text.length > 0)
        : [];

      return {
        visibleContent,
        payload: {
          type: "plan-intake",
          language: parsed.language === "zh" ? "zh" : "en",
          question: typeof parsed.question === "string" ? parsed.question.trim() : "",
          requiredFields,
          examples
        }
      };
    }

    if (parsed.type === "analysis-review") {
      const jobId =
        typeof parsed.jobId === "number"
          ? Math.round(parsed.jobId)
          : typeof parsed.job_id === "number"
          ? Math.round(parsed.job_id)
          : 0;

      if (jobId <= 0) {
        return {
          visibleContent,
          payload: null
        };
      }

      const planTypeHint = normalizePlanTypeValue(
        typeof parsed.suggestedPlanType === "string"
          ? parsed.suggestedPlanType
          : typeof parsed.planTypeHint === "string"
          ? parsed.planTypeHint
          : typeof parsed.plan_type_hint === "string"
          ? parsed.plan_type_hint
          : "course"
      );

      const suggestedStyle =
        typeof parsed.suggestedStyle === "string"
          ? parsed.suggestedStyle.trim()
          : typeof parsed.styleHint === "string"
          ? parsed.styleHint.trim()
          : typeof parsed.style_hint === "string"
          ? parsed.style_hint.trim()
          : typeof parsed.style === "string"
          ? parsed.style.trim()
          : "";

      const sourceUrl =
        typeof parsed.sourceUrl === "string"
          ? parsed.sourceUrl.trim()
          : typeof parsed.source_url === "string"
          ? parsed.source_url.trim()
          : "";

      const sourcePlatform =
        typeof parsed.sourcePlatform === "string"
          ? parsed.sourcePlatform.trim()
          : typeof parsed.source_platform === "string"
          ? parsed.source_platform.trim()
          : "unknown";

      const candidates: AnalysisReviewCandidate[] = Array.isArray(parsed.candidates)
        ? parsed.candidates
            .map((item) => (isRecord(item) ? item : {}))
            .map((record) => {
              const mappedExerciseId =
                typeof record.mappedExerciseId === "number"
                  ? Math.round(record.mappedExerciseId)
                  : typeof record.mapped_exercise_id === "number"
                  ? Math.round(record.mapped_exercise_id)
                  : 0;
              const alternatives: AnalysisReviewCandidateAlternative[] = Array.isArray(
                record.alternativeExercises ?? record.alternative_exercises
              )
                ? (record.alternativeExercises ?? record.alternative_exercises)
                    .map((option) => (isRecord(option) ? option : {}))
                    .map((optionRecord) => ({
                      exerciseId:
                        typeof optionRecord.exerciseId === "number"
                          ? Math.round(optionRecord.exerciseId)
                          : typeof optionRecord.exercise_id === "number"
                          ? Math.round(optionRecord.exercise_id)
                          : 0,
                      exerciseName:
                        typeof optionRecord.exerciseName === "string"
                          ? optionRecord.exerciseName.trim()
                          : typeof optionRecord.exercise_name === "string"
                          ? optionRecord.exercise_name.trim()
                          : "",
                      matchScore:
                        typeof optionRecord.matchScore === "number"
                          ? Math.max(0, optionRecord.matchScore)
                          : typeof optionRecord.match_score === "number"
                          ? Math.max(0, optionRecord.match_score)
                          : 0,
                      finalSelected:
                        typeof optionRecord.finalSelected === "number"
                          ? optionRecord.finalSelected > 0
                          : typeof optionRecord.final_selected === "number"
                          ? optionRecord.final_selected > 0
                          : false,
                      mappingSource:
                        typeof optionRecord.mappingSource === "string"
                          ? optionRecord.mappingSource.trim()
                          : typeof optionRecord.mapping_source === "string"
                          ? optionRecord.mapping_source.trim()
                          : ""
                    }))
                    .filter((option) => option.exerciseId > 0 && option.exerciseName)
                : [];
              return {
                candidateId:
                  typeof record.candidateId === "number"
                    ? Math.round(record.candidateId)
                    : typeof record.candidate_id === "number"
                    ? Math.round(record.candidate_id)
                    : 0,
                label:
                  typeof record.label === "string"
                    ? record.label.trim()
                    : typeof record.rawLabel === "string"
                    ? record.rawLabel.trim()
                    : typeof record.raw_label === "string"
                    ? record.raw_label.trim()
                    : typeof record.normalizedLabel === "string"
                    ? record.normalizedLabel.trim()
                    : typeof record.normalized_label === "string"
                    ? record.normalized_label.trim()
                    : "",
                reviewState:
                  typeof record.reviewState === "string"
                    ? record.reviewState.trim()
                    : typeof record.review_state === "string"
                    ? record.review_state.trim()
                    : "",
                notes: typeof record.notes === "string" ? record.notes.trim() : "",
                mappedExerciseId,
                mappedExerciseName:
                  typeof record.mappedExerciseName === "string"
                    ? record.mappedExerciseName.trim()
                    : typeof record.mapped_exercise_name === "string"
                    ? record.mapped_exercise_name.trim()
                    : "",
                matchScore:
                  typeof record.matchScore === "number"
                    ? Math.max(0, record.matchScore)
                    : typeof record.match_score === "number"
                    ? Math.max(0, record.match_score)
                    : 0,
                alternativeExercises: alternatives
              };
            })
            .filter((candidate) => candidate.candidateId > 0 && candidate.label)
        : [];

      const candidateCountFromPayload =
        typeof parsed.candidateCount === "number"
          ? Math.max(0, Math.round(parsed.candidateCount))
          : typeof parsed.candidate_count === "number"
          ? Math.max(0, Math.round(parsed.candidate_count))
          : 0;
      const unresolvedCountFromPayload =
        typeof parsed.unresolvedCount === "number"
          ? Math.max(0, Math.round(parsed.unresolvedCount))
          : typeof parsed.unresolved_count === "number"
          ? Math.max(0, Math.round(parsed.unresolved_count))
          : 0;
      const visualFrameCountFromPayload =
        typeof parsed.visualFrameCount === "number"
          ? Math.max(0, Math.round(parsed.visualFrameCount))
          : typeof parsed.visual_frame_count === "number"
          ? Math.max(0, Math.round(parsed.visual_frame_count))
          : 0;
      const visualFramesFromPayload: AnalysisReviewFrame[] = Array.isArray(
        parsed.visualFrames ?? parsed.visual_frames
      )
        ? (parsed.visualFrames ?? parsed.visual_frames)
            .map((item) => (isRecord(item) ? item : {}))
            .map((record) => {
              const assetId =
                typeof record.assetId === "number"
                  ? Math.round(record.assetId)
                  : typeof record.asset_id === "number"
                  ? Math.round(record.asset_id)
                  : 0;
              const approxSec =
                typeof record.approxSec === "number"
                  ? Math.max(0, record.approxSec)
                  : typeof record.approx_sec === "number"
                  ? Math.max(0, record.approx_sec)
                  : 0;
              const previewUrl =
                typeof record.previewUrl === "string"
                  ? record.previewUrl.trim()
                  : typeof record.preview_url === "string"
                  ? record.preview_url.trim()
                  : assetId > 0 && jobId > 0
                  ? `/api/v1/assistant/content/jobs/${jobId}/assets/${assetId}/file`
                  : "";
              return { assetId, approxSec, previewUrl };
            })
            .filter((frame) => frame.assetId > 0 && frame.previewUrl)
            .slice(0, 12)
        : [];
      const calculatedUnresolved = candidates.filter((candidate) => {
        const state = candidate.reviewState.toLowerCase();
        if (state === "pending" || state === "needs_review") return true;
        if (candidate.mappedExerciseId <= 0 && candidate.alternativeExercises.length <= 0) return true;
        return false;
      }).length;

      return {
        visibleContent,
        payload: {
          type: "analysis-review",
          language: parsed.language === "zh" ? "zh" : "en",
          jobId,
          sourcePlatform,
          sourceUrl,
          suggestedPlanType: planTypeHint,
          suggestedStyle: suggestedStyle || DEFAULT_WORKOUT_STYLE,
          contentType:
            typeof parsed.contentType === "string"
              ? parsed.contentType.trim()
              : typeof parsed.content_type === "string"
              ? parsed.content_type.trim()
              : "",
          summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
          textPreview:
            typeof parsed.textPreview === "string"
              ? parsed.textPreview.trim()
              : typeof parsed.text_preview === "string"
              ? parsed.text_preview.trim()
              : "",
          focusTerms: toTextArray(parsed.focusTerms ?? parsed.focus_terms),
          equipmentHints: toTextArray(parsed.equipmentHints ?? parsed.equipment_hints),
          riskFlags: toTextArray(parsed.riskFlags ?? parsed.risk_flags),
          segmentClues: toTextArray(parsed.segmentClues ?? parsed.segment_clues),
          visualFrameCount: visualFrameCountFromPayload,
          visualFrames: visualFramesFromPayload,
          requiredMaterial: toTextArray(parsed.requiredMaterial ?? parsed.required_material),
          candidateCount: Math.max(candidateCountFromPayload, candidates.length),
          unresolvedCount: Math.max(unresolvedCountFromPayload, calculatedUnresolved),
          candidates
        }
      };
    }

    if (parsed.type !== "plan-options" || !Array.isArray(parsed.options)) {
      return {
        visibleContent,
        payload: null
      };
    }

    const parseTemplateExercise = (rawExercise: unknown): PlanTemplateExercise => {
      const exercise = isRecord(rawExercise) ? rawExercise : {};
      return {
        exerciseId: Math.round(
          readNumberFromRecord(exercise, ["exerciseId", "exercise_id", "id"], 0)
        ),
        name:
          readTextFromRecord(exercise, ["name", "exerciseName", "exercise_name", "label"], "") || "",
        sets: Math.max(1, Math.round(readNumberFromRecord(exercise, ["sets", "set"], 3))),
        reps: Math.max(0, Math.round(readNumberFromRecord(exercise, ["reps", "rep"], 8))),
        restSeconds: Math.max(
          0,
          Math.round(readNumberFromRecord(exercise, ["restSeconds", "rest_seconds", "rest"], 60))
        ),
        timeSeconds: Math.max(
          0,
          Math.round(
            readNumberFromRecord(
              exercise,
              ["timeSeconds", "time_seconds", "durationSeconds", "duration_seconds", "time"],
              0
            )
          )
        ),
        rounds: Math.max(1, Math.round(readNumberFromRecord(exercise, ["rounds", "rnd", "round"], 1))),
        orderIndex: Math.max(
          0,
          Math.round(readNumberFromRecord(exercise, ["orderIndex", "order_index", "order"], 0))
        ),
        blockType:
          readTextFromRecord(exercise, ["blockType", "block_type", "type"], "") || "",
        blockTitle:
          readTextFromRecord(exercise, ["blockTitle", "block_title", "blockName", "block_name"], "") ||
          "",
        groupMethod:
          readTextFromRecord(exercise, ["groupMethod", "group_method", "method"], "") || "",
        dayName: readTextFromRecord(exercise, ["dayName", "day_name"], "") || "",
        note: readTextFromRecord(exercise, ["note", "notes"], "") || ""
      };
    };

    const options: PlanOptionCard[] = parsed.options
      .map((item) => (isRecord(item) ? item : {}))
      .map((record, optionIndex) => {
        const templateExercisesRaw =
          record.templateExercises ?? record.template_exercises ?? [];
        const templateExercises: PlanTemplateExercise[] = Array.isArray(templateExercisesRaw)
          ? templateExercisesRaw
              .map(parseTemplateExercise)
              .filter((exercise) => hasUsableExerciseRef(exercise))
          : [];

        const days: PlanDayCard[] = Array.isArray(record.days)
          ? record.days
              .map((day) => (isRecord(day) ? day : {}))
              .map((dayRecord) => ({
                dayName:
                  readTextFromRecord(dayRecord, ["dayName", "day_name", "name"], "") || "",
                focus: readTextFromRecord(dayRecord, ["focus", "goal"], "") || "",
                intervalProtocol:
                  readTextFromRecord(dayRecord, ["intervalProtocol", "interval_protocol"], "") || "",
                blocks: Array.isArray(dayRecord.blocks ?? dayRecord.phases)
                  ? (dayRecord.blocks ?? dayRecord.phases)
                      .map((block) => (isRecord(block) ? block : {}))
                      .map((blockRecord) => ({
                        type:
                          readTextFromRecord(blockRecord, ["type", "blockType", "block_type"], "") || "",
                        title:
                          readTextFromRecord(
                            blockRecord,
                            ["title", "blockName", "block_name", "name"],
                            ""
                          ) || "",
                        method:
                          readTextFromRecord(
                            blockRecord,
                            ["method", "groupMethod", "group_method"],
                            "Straight Sets"
                          ) || "Straight Sets",
                        items: Array.isArray(blockRecord.items ?? blockRecord.exercises)
                          ? (blockRecord.items ?? blockRecord.exercises)
                              .map(parseTemplateExercise)
                              .filter((exercise) => hasUsableExerciseRef(exercise))
                          : []
                      }))
                      .filter((block) => block.title && block.items.length > 0)
                  : []
              }))
              .filter((day) => day.dayName && day.blocks.length > 0)
          : [];

        const normalizedPlanKind =
          readTextFromRecord(
            record,
            ["planKind", "plan_kind", "planType", "plan_type", "kind"],
            ""
          ).toLowerCase();
        const kindHintText = [
          readTextFromRecord(record, ["title", "planTitle", "plan_title", "name"], ""),
          readTextFromRecord(record, ["rationale", "summary", "reason"], ""),
          readTextFromRecord(record, ["previewFocus", "preview_focus", "progression"], "")
        ]
          .join(" ")
          .toLowerCase();
        const inferredPlanKind: "course" | "module" =
          normalizedPlanKind === "module" ||
          /quick|mini|module|模块|快速训练/.test(kindHintText)
            ? "module"
            : "course";
        const normalizedCode =
          readTextFromRecord(record, ["code", "optionCode", "option_code"], "") ||
          toOptionCode(optionIndex + 1);
        const normalizedTitle =
          readTextFromRecord(record, ["title", "planTitle", "plan_title", "name"], "") ||
          `${parsed.language === "zh" ? "方案" : "Option"} ${toOptionCode(optionIndex + 1)}`;
        const normalizedRationale = readTextFromRecord(
          record,
          ["rationale", "summary", "reason"],
          ""
        );

        return {
          code: normalizedCode.trim().toUpperCase(),
          title: normalizedTitle.trim(),
          rationale: normalizedRationale.trim(),
          planKind: inferredPlanKind,
          requestedBlockFlow: toTextArray(
            record.requestedBlockFlow ?? record.requested_block_flow ?? record.blockFlow ?? record.block_flow
          ),
          sourceMode:
            readTextFromRecord(record, ["sourceMode", "source_mode", "generationMode", "generation_mode"], "")
              .toLowerCase()
              .includes("source")
              ? "source_reconstruction"
              : undefined,
          lockToSource:
            Boolean(record.lockToSource) ||
            Boolean(record.lock_to_source) ||
            readTextFromRecord(record, ["sourceMode", "source_mode", "generationMode", "generation_mode"], "")
              .toLowerCase()
              .includes("source"),
          programWeeks:
            Math.max(
              0,
              Math.round(readNumberFromRecord(record, ["programWeeks", "program_weeks"], 0))
            ),
          sessionsPerWeek:
            Math.max(
              1,
              Math.round(readNumberFromRecord(record, ["sessionsPerWeek", "sessions_per_week"], 1))
            ),
          sessionMinutes:
            Math.max(
              1,
              Math.round(
                readNumberFromRecord(
                  record,
                  ["sessionMinutes", "session_minutes", "durationMin", "duration_min"],
                  45
                )
              )
            ),
          previewFocus:
            readTextFromRecord(record, ["previewFocus", "preview_focus", "progression"], ""),
          templateExercises,
          days
        } as PlanOptionCard;
      })
      .filter((item) => {
        const hasText =
          Boolean(item.code.trim()) ||
          Boolean(item.title.trim()) ||
          Boolean(item.rationale.trim()) ||
          Boolean(item.previewFocus?.trim());
        const hasExercises =
          (item.templateExercises?.length ?? 0) > 0 ||
          (item.days?.some((day) => day.blocks.some((block) => block.items.length > 0)) ?? false);
        return hasText || hasExercises;
      });

    if (options.length === 0) {
      return {
        visibleContent,
        payload: null
      };
    }

    const payloadLanguage: "zh" | "en" = parsed.language === "zh" ? "zh" : "en";
    const reliableOptions = keepReliablePlanOptions(options, payloadLanguage);
    if (reliableOptions.length === 0) {
      return {
        visibleContent,
        payload: null
      };
    }

    return {
      visibleContent,
      payload: {
        type: "plan-options",
        language: payloadLanguage,
        options: ensurePlanOptionsMinimum(reliableOptions, payloadLanguage)
      }
    };
  } catch {
    return {
      visibleContent,
      payload: null
    };
  }
};


const toSafePositiveInt = (value: number, fallback: number) => {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.round(value);
};

const createBuilderBlocksFromTitles = (titles: string[]): BuilderWorkoutBlock[] =>
  titles.map((title, index) => ({
    id: `block-${index}`,
    title,
    groups: [
      {
        id: `group-${index}-0`,
        method: DEFAULT_GROUP_METHOD,
        items: []
      }
    ]
  }));

const normalizeGroupTypeForApply = (method: string) => {
  const normalized = method.trim().toLowerCase();
  if (normalized.includes("superset")) return "superset";
  if (normalized.includes("circuit")) return "circuit";
  if (normalized.includes("interval")) return "interval";
  if (normalized.includes("hiit")) return "hiit";
  return "straight_sets";
};

const inferWorkoutStyleFromOption = (option: PlanOptionCard) => {
  const styleNames = Object.keys(styleBlocksMap);
  const mergedText = [option.title, option.rationale, option.previewFocus]
    .join(" ")
    .toLowerCase();

  for (const styleName of styleNames) {
    if (mergedText.includes(styleName.toLowerCase())) {
      return styleName;
    }
  }

  const keywordStylePairs: Array<{ keywords: string[]; style: string }> = [
    {
      style: "Bodybuilding",
      keywords: ["bodybuilding", "hypertrophy", "muscle gain", "增肌", "肌肥大", "塑形"]
    },
    {
      style: "CrossFit",
      keywords: ["crossfit", "cross fit", "metcon", "wod", "交叉训练"]
    },
    {
      style: "Functional",
      keywords: ["functional", "movement quality", "function", "功能性", "功能训练"]
    },
    {
      style: "Mobility / Yoga",
      keywords: ["mobility", "yoga", "flexibility", "stretch", "活动度", "灵活", "瑜伽", "拉伸"]
    },
    {
      style: "Athletic",
      keywords: ["athletic", "agility", "speed", "sports performance", "竞技", "敏捷", "速度"]
    },
    {
      style: "Rehab",
      keywords: ["rehab", "rehabilitation", "corrective", "pain-free", "康复", "纠正", "疼痛"]
    }
  ];

  const match = keywordStylePairs.find((item) =>
    item.keywords.some((keyword) => mergedText.includes(keyword))
  );
  if (match) return match.style;

  return DEFAULT_WORKOUT_STYLE;
};

const normalizePlanTemplateExerciseWithCatalog = (
  exercise: PlanTemplateExercise,
  blockTitle: string,
  blockType: string
): PlanTemplateExercise => {
  const originalName = String(exercise.name ?? "").trim();
  const normalizedName = originalName;
  const hasConcreteName = normalizedName ? isLikelyConcreteExerciseLabel(normalizedName) : true;
  const existingId =
    hasConcreteName && Number.isFinite(exercise.exerciseId)
      ? Math.round(exercise.exerciseId)
      : 0;
  const phaseHint = inferFallbackPhaseFromHeading(`${blockTitle} ${blockType}`.trim());
  const resolvedByName =
    normalizedName && hasConcreteName
      ? resolveExerciseFromText(normalizedName, phaseHint)
      : { exerciseId: 0, name: normalizedName };

  let nextId = existingId > 0 ? existingId : 0;
  let nextName = normalizedName;

  if (nextId <= 0 && resolvedByName.exerciseId > 0) {
    nextId = resolvedByName.exerciseId;
    if (!nextName) {
      nextName = resolvedByName.name;
    }
  }

  if (nextId > 0 && nextName) {
    const catalogName = exerciseNameById.get(nextId)?.trim() || "";
    if (catalogName && !areLikelySameExerciseName(nextName, catalogName) && resolvedByName.exerciseId > 0) {
      nextId = resolvedByName.exerciseId;
      if (!nextName || isGenericExercisePlaceholderName(nextName)) {
        nextName = resolvedByName.name || catalogName;
      }
    } else if (catalogName && !areLikelySameExerciseName(nextName, catalogName)) {
      // AI payloads can hallucinate an exerciseId while the name is the real intent.
      // Keep the intended name and let materialization create a custom exercise instead of opening a wrong detail page.
      nextId = 0;
    }
  }

  if (!nextName && nextId > 0) {
    nextName = exerciseNameById.get(nextId)?.trim() || "";
  }

  return {
    ...exercise,
    exerciseId: nextId > 0 ? nextId : 0,
    name: nextName
  };
};

const normalizePlanOptionExercisesByCatalog = (option: PlanOptionCard): PlanOptionCard => {
  const normalizedTemplateExercises = (option.templateExercises ?? []).map((exercise) =>
    normalizePlanTemplateExerciseWithCatalog(
      exercise,
      exercise.blockTitle ?? "",
      exercise.blockType ?? ""
    )
  );

  const normalizedDays = (option.days ?? []).map((day) => ({
    ...day,
    blocks: day.blocks.map((block) => ({
      ...block,
      items: block.items.map((exercise) =>
        normalizePlanTemplateExerciseWithCatalog(
          exercise,
          block.title ?? exercise.blockTitle ?? "",
          block.type ?? exercise.blockType ?? ""
        )
      )
    }))
  }));

  return {
    ...option,
    templateExercises: normalizedTemplateExercises,
    days: normalizedDays
  };
};

const analyzePlanOptionQuality = (option: PlanOptionCard) => {
  const rows = collectTemplateRowsFromOption(option).filter((row) => hasUsableExerciseRef(row));
  const totalRows = rows.length;
  const counts = new Map<string, number>();
  let maxTimeSeconds = 0;
  rows.forEach((row) => {
    const nameKey = normalizeLookupText(String(row.name ?? ""));
    const rowKey =
      row.exerciseId > 0 ? `id:${row.exerciseId}` : nameKey ? `name:${nameKey}` : "name:unknown";
    counts.set(rowKey, (counts.get(rowKey) ?? 0) + 1);
    maxTimeSeconds = Math.max(maxTimeSeconds, Math.max(0, Number(row.timeSeconds) || 0));
  });
  const uniqueExerciseCount = counts.size;
  const dominantCount = counts.size > 0 ? Math.max(...Array.from(counts.values())) : 0;
  const dominantShare = totalRows > 0 ? dominantCount / totalRows : 1;
  return {
    totalRows,
    uniqueExerciseCount,
    dominantCount,
    dominantShare,
    maxTimeSeconds
  };
};

const isLowQualityPlanOption = (option: PlanOptionCard) => {
  const metrics = analyzePlanOptionQuality(option);
  if (metrics.totalRows <= 0) return true;
  if (isSourceReconstructionOption(option)) {
    return metrics.totalRows > 80;
  }
  if (metrics.totalRows >= 4 && metrics.uniqueExerciseCount <= 1) return true;
  if (metrics.totalRows >= 8 && metrics.uniqueExerciseCount <= 2) return true;
  if (metrics.totalRows >= 10 && metrics.dominantShare >= 0.7) return true;
  if (metrics.maxTimeSeconds > 900 && metrics.totalRows >= 6) return true;
  if (metrics.totalRows > 48) return true;
  return false;
};

const keepReliablePlanOptions = (
  options: PlanOptionCard[],
  language?: "zh" | "en",
  contextText = ""
) =>
  options
    .map((option) => normalizePlanOptionExercisesByCatalog(option))
    .map((option, index) =>
      isSourceReconstructionOption(option)
        ? option
        : ensureCompleteCourseOption(option, language, contextText, index)
    )
    .map((option, index) =>
      isSourceReconstructionOption(option) ? option : differentiatePlanOption(option, language, index)
    )
    .filter((option) => !isLowQualityPlanOption(option));

const collectTemplateRowsFromOption = (option: PlanOptionCard): PlanTemplateExercise[] => {
  const fromTemplate = [...(option.templateExercises ?? [])]
    .filter((item) => hasUsableExerciseRef(item))
    .map((item, index) => ({
      ...item,
      orderIndex: item.orderIndex > 0 ? item.orderIndex : index + 1
    }))
    .sort((a, b) => a.orderIndex - b.orderIndex);
  if (fromTemplate.length > 0) {
    return fromTemplate;
  }

  const fromDays: PlanTemplateExercise[] = [];
  let order = 1;
  (option.days ?? []).forEach((day) => {
    day.blocks.forEach((block) => {
      block.items.forEach((item) => {
        if (!hasUsableExerciseRef(item)) return;
        fromDays.push({
          ...item,
          blockType: block.type || item.blockType,
          blockTitle: block.title,
          groupMethod: block.method,
          dayName: day.dayName,
          orderIndex: order
        });
        order += 1;
      });
    });
  });
  return fromDays;
};

const buildWorkoutBuilderDraftFromOption = (
  option: PlanOptionCard,
  language: "zh" | "en" | undefined
): { draft: WorkoutBuilderDraftPayload; style: string; blockTitles: string[] } => {
  const style = inferWorkoutStyleFromOption(option);
  const fallbackBlockTitles = styleBlocksMap[style] ?? styleBlocksMap[DEFAULT_WORKOUT_STYLE];
  const fallbackNamePrefix = language === "zh" ? "动作" : "Exercise";
  const exerciseNameMap = new Map(exercises.map((exercise) => [String(exercise.id), exercise.name]));
  const rows = collectTemplateRowsFromOption(option);
  const defaultTitleByBlockType: Record<string, string> = {
    warmup: "Warmup",
    activation: "Activation",
    primary: "Strength",
    secondary: "Strength",
    accessory: "Accessory",
    conditioning: "Conditioning",
    cooldown: "Cooldown"
  };

  const resolveRowBlockTitle = (row: PlanTemplateExercise) => {
    const explicit = row.blockTitle?.trim();
    if (explicit) return explicit;
    const normalizedType = (row.blockType ?? "").trim().toLowerCase();
    if (!normalizedType) return "";
    const guessed = defaultTitleByBlockType[normalizedType] ?? "";
    if (!guessed) return "";
    const existing = fallbackBlockTitles.find(
      (title) => title.trim().toLowerCase() === guessed.toLowerCase()
    );
    return existing ?? guessed;
  };

  const candidateBlockTitles = [
    ...rows.map((row) => resolveRowBlockTitle(row)).filter(Boolean),
    ...(option.days ?? []).flatMap((day) => day.blocks.map((block) => block.title.trim()))
  ];
  const uniqueBlockTitles = Array.from(
    new Set(candidateBlockTitles.filter((title) => title.length > 0))
  );
  const blockTitles = uniqueBlockTitles.length > 0 ? uniqueBlockTitles : fallbackBlockTitles;
  const blocks = createBuilderBlocksFromTitles(blockTitles);

  const defaultMethodForBlock = (blockTitle: string) => {
    const lower = blockTitle.toLowerCase();
    if (lower.includes("warm")) return "Circuit";
    if (lower.includes("cool")) return "Circuit";
    if (lower.includes("condition")) return "Interval";
    return DEFAULT_GROUP_METHOD;
  };

  const findBlockByTitle = (blockTitle?: string) => {
    const normalized = (blockTitle ?? "").trim().toLowerCase();
    if (!normalized) return blocks[0];
    return blocks.find((block) => block.title.trim().toLowerCase() === normalized) ?? blocks[0];
  };

  rows.forEach((item, index) => {
    const targetBlock = findBlockByTitle(resolveRowBlockTitle(item));
    if (!targetBlock) return;
    const normalizedMethod = (item.groupMethod ?? "").trim() || defaultMethodForBlock(targetBlock.title);
    let targetGroup = targetBlock.groups.find(
      (group) => group.method.trim().toLowerCase() === normalizedMethod.toLowerCase()
    );
    if (!targetGroup) {
      targetGroup = {
        id: `group-${targetBlock.id}-${targetBlock.groups.length}`,
        method: normalizedMethod,
        items: []
      };
      targetBlock.groups.push(targetGroup);
    }

    const exerciseId = String(item.exerciseId);
    const name =
      item.name?.trim() || exerciseNameMap.get(exerciseId) || `${fallbackNamePrefix} #${exerciseId}`;
    targetGroup.items.push({
      uid: `${exerciseId}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      id: exerciseId,
      name,
      sets: toSafePositiveInt(item.sets, 3),
      reps: toSafePositiveInt(item.reps, 8),
      rest: Math.max(0, toSafePositiveInt(item.restSeconds, 0)),
      time: Math.max(0, toSafePositiveInt(item.timeSeconds, 0)),
      rounds: toSafePositiveInt(item.rounds, 1),
      source: "template"
    });
  });

  // Remove placeholder groups that have no exercises after draft hydration.
  blocks.forEach((block) => {
    block.groups = block.groups.filter((group) => group.items.length > 0);
  });

  const activeGroupByBlock = Object.fromEntries(
    blocks.map((block) => [block.id, block.groups[0]?.id ?? ""])
  );
  const collapsedBlocks = Object.fromEntries(blocks.map((block) => [block.id, false]));
  const templatePoolIds = [...new Set(rows.map((row) => String(row.exerciseId)))];
  const sessionPrefix = language === "zh" ? "AI方案" : "AI Plan";
  const title = option.title?.trim() || option.code?.trim() || (language === "zh" ? "训练课" : "Session");
  const sessionName = `${sessionPrefix} ${title}`.slice(0, 64);

  return {
    style,
    blockTitles,
    draft: {
      sessionName,
      trainingStyle: style,
      templatePoolIds,
      blocks,
      activeBlockId: blocks[0]?.id ?? "block-0",
      activeGroupByBlock,
      collapsedBlocks
    }
  };
};

const writePlanOptionToWorkoutBuilderDraft = (
  option: PlanOptionCard,
  language: "zh" | "en" | undefined
) => {
  if (typeof window === "undefined") return;
  const { draft, style, blockTitles } = buildWorkoutBuilderDraftFromOption(option, language);
  window.localStorage.setItem(
    "workoutStyleSelection",
    JSON.stringify({
      style,
      blocks: blockTitles
    })
  );
  window.localStorage.setItem("workoutBuilderLastStyle", style);
  window.localStorage.setItem(`workoutBuilderDraft:${style}`, JSON.stringify(draft));
};

const writePlanOptionToQuickModuleDraft = (
  option: PlanOptionCard,
  language: "zh" | "en" | undefined
) => {
  if (typeof window === "undefined") return;
  const rows = collectTemplateRowsFromOption(option);
  const exercisesForModule: QuickModuleDraftExercise[] = rows
    .filter((item) => item.exerciseId > 0)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((item, index) => ({
      exerciseId: item.exerciseId,
      sets: toSafePositiveInt(item.sets, 3),
      reps: toSafePositiveInt(item.reps, 8),
      restSeconds: Math.max(0, toSafePositiveInt(item.restSeconds, 0)),
      timeSeconds: Math.max(0, toSafePositiveInt(item.timeSeconds, 0)),
      rounds: toSafePositiveInt(item.rounds, 1),
      orderIndex: index + 1
    }));
  if (exercisesForModule.length === 0) return;

  const title = option.title?.trim() || option.code?.trim() || (language === "zh" ? "快速模块" : "Quick Module");
  const prefix = language === "zh" ? "AI模块" : "AI Module";
  const payload: QuickModuleDraftPayload = {
    templateName: `${prefix} ${title}`.slice(0, 64),
    exercises: exercisesForModule
  };
  window.localStorage.setItem(AI_QUICK_MODULE_DRAFT_KEY, JSON.stringify(payload));
};

const buildDirectApplyStructureFromOption = (
  option: PlanOptionCard,
  payloadLanguage: "zh" | "en" | undefined
) => {
  const planType = option.planKind === "module" ? "module" : "course";
  const { draft, style } = buildWorkoutBuilderDraftFromOption(option, payloadLanguage);
  const title = option.title?.trim() || option.code?.trim() || "AI Plan";
  const blocks = draft.blocks
    .map((block) => {
      const groups = block.groups
        .map((group) => {
          const exercises = group.items
            .map((item) => {
              const exerciseId = Number(item.id);
              if (!Number.isFinite(exerciseId) || exerciseId <= 0) return null;
              return {
                exercise_id: Math.round(exerciseId),
                sets: toSafePositiveInt(item.sets, 3),
                reps: Math.max(0, toSafePositiveInt(item.reps, 8)),
                rest_seconds: Math.max(0, toSafePositiveInt(item.rest, 0)),
                time_seconds: Math.max(0, toSafePositiveInt(item.time, 0)),
                rounds: toSafePositiveInt(item.rounds, 1),
                rnd: toSafePositiveInt(item.rounds, 1)
              };
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item));
          if (exercises.length === 0) return null;

          const groupRounds = Math.max(
            1,
            ...exercises.map((exercise) => toSafePositiveInt(exercise.rounds, 1))
          );
          return {
            group_type: normalizeGroupTypeForApply(group.method),
            rounds: groupRounds,
            exercises
          };
        })
        .filter((group): group is NonNullable<typeof group> => Boolean(group));
      if (groups.length === 0) return null;
      return {
        block_name: block.title.trim() || "Block",
        groups
      };
    })
    .filter((block): block is NonNullable<typeof block> => Boolean(block));

  if (blocks.length === 0) {
    throw new Error("Plan has no valid exercises to apply.");
  }

  return {
    plan_type: planType,
    style,
    title,
    blocks
  };
};

function FloatingAvatarCompanion({ mode = "idle" }: { mode?: CompanionMode }) {
  const { language, t } = useI18n();
  const navigate = useNavigate();
  const fallbackAssistantMessage = React.useMemo(
    () =>
      createFallbackAssistantMessage(
        t(
          "assistant.welcome",
          "I am your Somatic AI assistant. Ask about movement form, training plans, or recovery."
        )
      ),
    [t]
  );
  const [isOpen, setIsOpen] = useState(false);
  const [assistantRouteMode, setAssistantRouteMode] = useState<AssistantRouteMode>(() => {
    if (typeof window === "undefined") return "plan";
    const raw = window.localStorage.getItem(ASSISTANT_ROUTE_STORAGE_KEY);
    return raw === "qa" ? "qa" : "plan";
  });
  const [planEntryMode, setPlanEntryMode] = useState<PlanEntryMode>(() => {
    if (typeof window === "undefined") return "auto";
    const raw = window.localStorage.getItem(ASSISTANT_PLAN_ENTRY_STORAGE_KEY);
    return raw === "link" || raw === "nl" ? raw : "auto";
  });
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<CompanionChatMessage[]>(() => [
    fallbackAssistantMessage
  ]);
  const [draft, setDraft] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlanCards, setExpandedPlanCards] = useState<Record<string, boolean>>({});
  const [analysisReviewDrafts, setAnalysisReviewDrafts] = useState<
    Record<string, AnalysisReviewDraftState>
  >({});
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const sessionPromiseRef = useRef<Promise<number> | null>(null);
  const lastPlanGoalRef = useRef("");
  const customExerciseCacheRef = useRef<Map<string, { id: number; name: string }>>(new Map());

  const floatAnimation = mode === "training" ? { y: [0, -4, 0] } : { y: [0, -10, 0] };
  const isPlanMode = assistantRouteMode === "plan";
  const routeTitle = isPlanMode
    ? language === "zh"
      ? "AI 训练编排"
      : "AI Plan Builder"
    : language === "zh"
    ? "AI 问答助手"
    : "AI Q&A";
  const routeSubtitle = isPlanMode
    ? language === "zh"
      ? "Function Calling"
      : "Function Calling"
    : language === "zh"
    ? "RAG Knowledge QA"
    : "RAG Knowledge QA";

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ASSISTANT_ROUTE_STORAGE_KEY, assistantRouteMode);
  }, [assistantRouteMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ASSISTANT_PLAN_ENTRY_STORAGE_KEY, planEntryMode);
  }, [planEntryMode]);

  useEffect(() => {
    sessionPromiseRef.current = null;
    lastPlanGoalRef.current = "";
    setSessionId(null);
    setExpandedPlanCards({});
    setAnalysisReviewDrafts({});
    setMessages([fallbackAssistantMessage]);
    setDraft("");
    setError(null);
  }, [assistantRouteMode, fallbackAssistantMessage]);

  useEffect(() => {
    if (!isOpen) return;
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [isOpen, messages, isSending]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0]?.id === "welcome") {
        return [fallbackAssistantMessage];
      }
      return prev;
    });
  }, [fallbackAssistantMessage, language]);

  const ensureSession = async () => {
    if (sessionId) return sessionId;
    if (sessionPromiseRef.current) return sessionPromiseRef.current;

    const userId = resolveAssistantUserId();
    const task = (async () => {
      const localSessionId = readAssistantSessionId(userId, assistantRouteMode);
      if (localSessionId) {
        try {
          const remote = await fetchAssistantSession(localSessionId);
          if (remote.id > 0) return remote.id;
        } catch {
          // Session id may be stale, create a fresh one below.
        }
      }

      const created = await createAssistantSession(userId, "Coach");
      writeAssistantSessionId(userId, assistantRouteMode, created.id);
      return created.id;
    })();

    sessionPromiseRef.current = task;
    try {
      return await task;
    } finally {
      sessionPromiseRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const bootstrapChat = async () => {
      setIsBootstrapping(true);
      setError(null);
      try {
        const activeSessionId = await ensureSession();
        if (cancelled) return;
        setSessionId(activeSessionId);

        const history = await fetchAssistantMessages(activeSessionId);
        if (cancelled) return;

        const normalized = history
          .filter((item) => item.content.trim())
          .map((item) => ({
            id: item.id > 0 ? String(item.id) : `assistant-${Date.now()}`,
            role: item.role === "user" ? "user" : "assistant",
            content: item.content,
            createTime: item.createTime
          })) as CompanionChatMessage[];

        setMessages(normalized.length > 0 ? normalized : [fallbackAssistantMessage]);
      } catch (bootstrapError) {
        const message =
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "Failed to connect assistant session.";
        setError(message);
        setMessages([fallbackAssistantMessage]);
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrapChat();

    return () => {
      cancelled = true;
    };
  }, [isOpen, assistantRouteMode, fallbackAssistantMessage]);

  const handleStartNewSession = () => {
    const userId = resolveAssistantUserId();
    clearAssistantSessionId(userId, assistantRouteMode);
    sessionPromiseRef.current = null;
    lastPlanGoalRef.current = "";
    setSessionId(null);
    setExpandedPlanCards({});
    setAnalysisReviewDrafts({});
    setMessages([fallbackAssistantMessage]);
    setDraft("");
    setError(null);
  };

  const recoverStructuredPlanReply = async (
    activeSessionId: number,
    requestContent: string,
    rawAssistantContent: string
  ) => {
    if (assistantRouteMode !== "plan") return rawAssistantContent;
    const parsed = parseAssistantStructuredPayload(rawAssistantContent);
    const visible = parsed.visibleContent.trim();
    const payloadLanguage: "zh" | "en" = language === "zh" ? "zh" : "en";
    const scopeAlreadyConfirmed = /计划类型已确认|plan type confirmed/i.test(requestContent);

    const buildThreeOptionRecoveryPrompt = (sourceText: string) =>
      payloadLanguage === "zh"
        ? [
            "上一条训练计划没有给够3个真实可选方案。请重新生成结构化JSON，并只输出一个载荷块。",
            "必须使用标记：[SB_PLAN_JSON]{...}[/SB_PLAN_JSON]",
            "要求：",
            "1) payload.type 必须是 \"plan-options\"。",
            "2) options 必须正好包含3个不同方案（A/B/C），每个都是单次训练，不是周计划。",
            "3) 三个方案要在训练方法上明显不同，例如技术力量 / 容量控制 / 爆发密度，而不是复制同一方案。",
            "4) 每个 option 都要有 title、rationale、planKind、sessionMinutes。",
            "5) 如果是完整训练课且用户没指定阶段，按训练风格固定block完整生成；每个block至少一个动作。",
            "6) 每个 item.name 只能是具体动作名，不允许把目标、解释、段落标题、整句描述写成动作名。",
            "7) 找不到动作库匹配时 exerciseId=0 且保留真实动作名；不要用无关常见动作顶替。",
            "8) 不要额外文字。",
            "",
            `[原始用户需求]\n${requestContent}`,
            "",
            `[上一条回复]\n${sourceText}`
          ].join("\n")
        : [
            "The previous training plan did not include 3 real options. Regenerate structured JSON and output only one payload block.",
            "Use exact markers: [SB_PLAN_JSON]{...}[/SB_PLAN_JSON]",
            "Rules:",
            "1) payload.type must be \"plan-options\".",
            "2) options must contain exactly 3 distinct options (A/B/C), each a single-session plan, not weekly programming.",
            "3) make the three options meaningfully different, e.g. Technique Strength / Volume Control / Power Density.",
            "4) each option must include title, rationale, planKind, sessionMinutes.",
            "5) for Full Course without user-specified stages, use the inferred style's complete fixed block flow; every block needs at least one exercise.",
            "6) every item.name must be a concrete exercise name only; never put goals, explanations, headings, or full sentences in exercise names.",
            "7) when no catalog match is available, use exerciseId=0 with the real exercise name; do not substitute unrelated common movements.",
            "8) no extra text outside payload.",
            "",
            `[Original user request]\n${requestContent}`,
            "",
            `[Previous reply]\n${sourceText}`
          ].join("\n");

    const tryRecoverThreeOptions = async (sourceText: string) => {
      try {
        const recovered = await chatWithAssistant({
          sessionId: activeSessionId,
          content: buildThreeOptionRecoveryPrompt(sourceText),
          mode: assistantRouteMode
        });
        const recoveredParsed = parseAssistantStructuredPayload(recovered.content);
        if (recoveredParsed.payload?.type !== "plan-options") return null;
        const reliableOptions = keepReliablePlanOptions(
          recoveredParsed.payload.options,
          payloadLanguage,
          requestContent
        );
        const normalizedOptions = ensurePlanOptionsMinimum(reliableOptions, payloadLanguage);
        const executableOptionCount = normalizedOptions.filter(
          (option) => collectTemplateRowsFromOption(option).length > 0
        ).length;
        if (normalizedOptions.length < 3 || executableOptionCount < 3) return null;
        const mergedPayload: PlanOptionsPayload = {
          ...recoveredParsed.payload,
          language: payloadLanguage,
          options: normalizedOptions
        };
        const intro =
          payloadLanguage === "zh"
            ? "已重新生成 3 个不同的可视化训练方案，请先查看详情再确认。"
            : "Regenerated 3 distinct visual plan options. Review details before confirming.";
        return `${intro}\n\n${PLAN_PAYLOAD_START}${JSON.stringify(mergedPayload)}${PLAN_PAYLOAD_END}`;
      } catch {
        return null;
      }
    };

    if (rawAssistantContent.includes(PLAN_PAYLOAD_START)) {
      if (parsed.payload?.type === "plan-options") {
        const isSourceLocked = parsed.payload.options.some((option) => isSourceReconstructionOption(option));
        const reliableOptions = keepReliablePlanOptions(
          parsed.payload.options,
          payloadLanguage,
          requestContent
        );
        if (!isSourceLocked && reliableOptions.length < 3) {
          const recovered = await tryRecoverThreeOptions(rawAssistantContent);
          if (recovered) return recovered;
        }
      }
      return rawAssistantContent;
    }

    if (detectAssistantScopeQuestion(visible)) {
      if (!scopeAlreadyConfirmed) {
        return `${visible}\n\n${buildScopePayloadMessage(payloadLanguage)}`;
      }
    }

    const recoveryPrompt =
      payloadLanguage === "zh"
        ? [
            "请将下面这段训练回复转换为结构化JSON，并只输出一个载荷块。",
            "必须使用标记：[SB_PLAN_JSON]{...}[/SB_PLAN_JSON]",
            "要求：",
            "1) payload.type 必须是 \"plan-options\"。",
            "2) options 至少3个（A/B/C）。",
            "3) 每个 option 都要有 title、rationale、planKind、sessionMinutes。",
            "4) 如果原始用户需求指定了热身/主训练/冷身等阶段，写入 requestedBlockFlow，并确保每个指定阶段都有动作。",
            "5) 如果是完整训练课且用户没指定阶段，按训练风格固定block完整生成；每个block至少一个动作。",
            "6) 每个 item 要有 exerciseId、name、sets、reps、restSeconds、timeSeconds、rounds；找不到动作库匹配时 exerciseId=0 且保留真实动作名。",
            "7) 不要额外文字。",
            "",
            `[原始用户需求]\n${requestContent}`,
            "",
            `[待转换文本]\n${visible}`
          ].join("\n")
        : [
            "Convert the following training reply into structured JSON and output only one payload block.",
            "Use exact markers: [SB_PLAN_JSON]{...}[/SB_PLAN_JSON]",
            "Rules:",
            "1) payload.type must be \"plan-options\".",
            "2) options must contain at least 3 entries (A/B/C).",
            "3) each option must include title, rationale, planKind, sessionMinutes.",
            "4) if the original request specified stages such as Warmup/Main/Cooldown, include requestedBlockFlow and make every requested stage non-empty.",
            "5) for Full Course without specified stages, use the inferred style's complete fixed block flow; every block needs at least one exercise.",
            "6) each item fields: exerciseId, name, sets, reps, restSeconds, timeSeconds, rounds; use exerciseId=0 with the real name when no catalog match exists.",
            "7) no extra text outside payload.",
            "",
            `[Original user request]\n${requestContent}`,
            "",
            `[Text to convert]\n${visible}`
          ].join("\n");

    try {
      const recovered = await chatWithAssistant({
        sessionId: activeSessionId,
        content: recoveryPrompt,
        mode: assistantRouteMode
      });
      const recoveredParsed = parseAssistantStructuredPayload(recovered.content);
      if (recoveredParsed.payload?.type === "plan-options") {
        const reliableOptions = keepReliablePlanOptions(
          recoveredParsed.payload.options,
          payloadLanguage,
          requestContent
        );
        const normalizedOptions = ensurePlanOptionsMinimum(reliableOptions, payloadLanguage);
        const hasExecutableRows = normalizedOptions.some(
          (option) => collectTemplateRowsFromOption(option).length > 0
        );
        if (normalizedOptions.length < 3 || !hasExecutableRows) {
          throw new Error("Recovered payload has no executable exercises.");
        }
        const mergedPayload: PlanOptionsPayload = {
          ...recoveredParsed.payload,
          language: payloadLanguage,
          options: normalizedOptions
        };
        return `${visible}\n\n${PLAN_PAYLOAD_START}${JSON.stringify(mergedPayload)}${PLAN_PAYLOAD_END}`;
      }
    } catch {
      // Fall through to local text-based synthesis.
    }

    const localFallbackPayload = buildFallbackPlanOptionsFromPlainText(visible, payloadLanguage);
    if (localFallbackPayload) {
      const reliableFallbackOptions = keepReliablePlanOptions(
        localFallbackPayload.options,
        payloadLanguage,
        requestContent
      );
      if (reliableFallbackOptions.length === 0) {
        return rawAssistantContent;
      }
      const normalizedFallbackPayload: PlanOptionsPayload = {
        ...localFallbackPayload,
        options: ensurePlanOptionsMinimum(reliableFallbackOptions, payloadLanguage)
      };
      return `${visible}\n\n${PLAN_PAYLOAD_START}${JSON.stringify(normalizedFallbackPayload)}${PLAN_PAYLOAD_END}`;
    }
    return rawAssistantContent;
  };

  const sendMessage = async (overrideContent?: string) => {
    const content = (overrideContent ?? draft).trim();
    if (!content || isSending || isBootstrapping) return;

    setError(null);
    setDraft("");

    const userMessage: CompanionChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);

    try {
      const activeSessionId = sessionId ?? (await ensureSession());
      setSessionId(activeSessionId);
      let requestContent = content;

      if (assistantRouteMode === "plan") {
        const payloadLanguage: "zh" | "en" = language === "zh" ? "zh" : "en";
        const scopeChoice = detectScopeOnlyReply(content);
        const scopeHintInSentence = detectScopePreferenceInText(content);
        const sourceUrlFromInput = extractFirstContentUrl(content);
        const entryModeFromInput: "link" | "nl" =
          planEntryMode === "auto" ? (sourceUrlFromInput ? "link" : "nl") : planEntryMode;
        if (scopeChoice) {
          const goal = lastPlanGoalRef.current.trim();
          requestContent = `${
            goal || (language === "zh" ? "用户目标：1000米专项训练" : "User goal: 1000m specific training")
          }\n${
              language === "zh"
                ? `计划类型已确认：${scopeChoice === "course" ? "完整训练课" : "快速模块"}。请立即输出3个不同的单次训练可选方案（A/B/C），不要再次询问训练类型。若为完整训练课：用户指定了阶段就严格按指定阶段；未指定阶段就按训练风格的固定block完整编排，每个block必须有动作。`
                : `Plan type confirmed: ${scopeChoice === "course" ? "Full Course session" : "Quick Module"}. Output 3 distinct single-session options (A/B/C) now and do not ask plan type again. For a Full Course: follow user-specified stages exactly; otherwise infer style and include every required style block, each with exercises.`
          }`;
        } else {
          if (entryModeFromInput === "nl" && (isGreetingOnlyInput(content) || !hasTrainingIntent(content))) {
            const hint =
              payloadLanguage === "zh"
                ? "请先描述训练目标（例如：1000米专项、踝关节稳定性）或直接发送短视频链接。"
                : "Please describe your training goal first (for example: 1000m specific or ankle stability), or send a short-video link.";
            setMessages((prev) => [
              ...prev,
              {
                id: `local-assistant-intake-${Date.now()}`,
                role: "assistant",
                content: `${hint}\n\n${buildIntakePayloadMessage(payloadLanguage)}`
              }
            ]);
            return;
          }
          if (entryModeFromInput === "nl" && !scopeHintInSentence) {
            lastPlanGoalRef.current = content;
            const scopeIntro =
              payloadLanguage === "zh"
                ? `已识别训练目标：${content}\n请选择本次是“完整训练课”还是“快速模块”。`
                : `Training goal detected: ${content}\nChoose Full Course session or Quick Module.`;
            setMessages((prev) => [
              ...prev,
              {
                id: `local-assistant-scope-${Date.now()}`,
                role: "assistant",
                content: `${scopeIntro}\n\n${buildScopePayloadMessage(payloadLanguage)}`
              }
            ]);
            return;
          }

          lastPlanGoalRef.current = content;
          if (entryModeFromInput === "nl" && scopeHintInSentence) {
            requestContent = `${content}\n${
              language === "zh"
                ? `计划类型已确认：${scopeHintInSentence === "course" ? "完整训练课" : "快速模块"}。请直接生成3个可选方案（A/B/C），并附结构化载荷。若为完整训练课：用户指定了阶段就严格按指定阶段；未指定阶段就按训练风格的固定block完整编排，每个block必须有动作。`
                : `Plan type confirmed: ${scopeHintInSentence === "course" ? "Full Course session" : "Quick Module"}. Generate 3 options (A/B/C) directly with structured payload. For a Full Course: follow user-specified stages exactly; otherwise infer style and include every required style block, each with exercises.`
            }`;
          }
        }
      }

      if (assistantRouteMode === "plan") {
        const sourceUrl = extractFirstContentUrl(requestContent);
        const resolvedEntryMode: "link" | "nl" =
          planEntryMode === "auto" ? (sourceUrl ? "link" : "nl") : planEntryMode;

        if (resolvedEntryMode === "link" && !sourceUrl) {
          const prompt =
            language === "zh"
              ? "当前是“链接解析”模式，请先发送一个短视频链接；或切换到“自然语言”模式直接描述训练目标。"
              : "You are in link-analysis mode. Please send a short-video URL first, or switch to natural-language mode.";
          setMessages((prev) => [
            ...prev,
            {
              id: `local-assistant-link-hint-${Date.now()}`,
              role: "assistant",
              content: prompt
            }
          ]);
          return;
        }

        if (resolvedEntryMode === "link" && sourceUrl) {
          const requestedPlanType = inferPlanTypeFromInput(requestContent);
          const styleHint = inferStyleHintFromInput(requestContent);
          const userId = resolveWorkoutUserId();
          const createdJob = await createAssistantContentJob({
            userId,
            sourceUrl,
            goalType: requestedPlanType,
            analysisMode: "auto",
            userConstraints: {
              source: "assistant_plan_chat",
              rawInput: requestContent
            }
          });
          const analyzed = await startAssistantContentAnalyze(createdJob.jobId);
          let reviewedJob = analyzed;
          if (!reviewedJob.analysisResult) {
            try {
              reviewedJob = await fetchAssistantContentJob(createdJob.jobId);
            } catch {
              reviewedJob = analyzed;
            }
          }
          let candidates: AssistantContentCandidate[] = [];
          try {
            candidates = await fetchAssistantContentCandidates(createdJob.jobId);
          } catch {
            candidates = [];
          }
          const payloadLanguage: "zh" | "en" = language === "zh" ? "zh" : "en";
          const analysisPayload = buildAnalysisReviewPayloadFromJob(
            reviewedJob,
            candidates,
            payloadLanguage,
            requestedPlanType,
            styleHint,
            sourceUrl
          );
          const materialText =
            analysisPayload.requiredMaterial.length > 0
              ? payloadLanguage === "zh"
                ? `建议补充素材：${analysisPayload.requiredMaterial.join(" / ")}`
                : `Suggested extra materials: ${analysisPayload.requiredMaterial.join(" / ")}`
              : "";
          const summaryText =
            payloadLanguage === "zh"
              ? `链接解析完成（${analysisPayload.sourcePlatform || "unknown"}）。请先确认训练类型、风格与候选动作，再生成一个视频训练计划。`
              : `Link parsed (${analysisPayload.sourcePlatform || "unknown"}). Confirm plan type, style, and candidate movements before generating one source video plan.`;
          const assistantContent = [
            summaryText,
            materialText,
            `${PLAN_PAYLOAD_START}${JSON.stringify(analysisPayload)}${PLAN_PAYLOAD_END}`
          ]
            .filter(Boolean)
            .join("\n");
          setMessages((prev) => [
            ...prev,
            {
              id: `local-assistant-link-${Date.now()}`,
              role: "assistant",
              content: assistantContent
            }
          ]);
          return;
        }
      }

      const constrainedContent =
        assistantRouteMode === "plan"
          ? `${requestContent}\n\n[Planner constraints - natural language mode]\nGenerate THREE distinct single-session plan options (A/B/C) for the confirmed scope: either Full Course session or Quick Module.\nEach option is one training session only. Do not output weekly or multi-day programming.\nIf user scope is unclear, ask to confirm: Full Course session vs Quick Module.\nIf the user explicitly says the session contains stages such as Warmup / Main Training / Cooldown, use exactly those stages and allocate concrete exercises inside every requested stage.\nIf the confirmed type is Full Course and the user did NOT specify stages, infer the closest training style from the intent and include EVERY block from that style's fixed block flow.\nFixed Full Course block flows:\n${COURSE_STYLE_BLOCK_GUIDE}\nFor Quick Module, do NOT open or design a full course; keep it as a focused module.\nUse professional block-by-block structure with concrete sets/reps/rest/time/rounds.\nEvery generated block must contain at least one concrete exercise row.\nEvery item.name must be a concrete movement label only. Never put goals, explanations, headings, or full narrative sentences into exercise names.\nIf a suitable catalog exercise is unavailable, keep exerciseId=0 and provide the real exercise name; do not substitute an unrelated common exercise.\nDo NOT collapse the whole session into one repeated movement.\nUnless user explicitly requests a single-exercise protocol, keep exercise diversity:\n- Full Course: at least 4 unique exercises per option\n- Quick Module: at least 3 unique exercises per option\n\n[Entry mode]\n${planEntryMode === "link" ? "link-analysis" : planEntryMode === "nl" ? "natural-language" : "auto"}\n\n[Output contract - REQUIRED]\nYou MUST append one structured payload block at the end of the reply.\nUse exact markers:\n[SB_PLAN_JSON]{...}[/SB_PLAN_JSON]\nIf asking scope, output payload type = \"plan-scope\".\nIf generating plan in natural-language mode, output payload type = \"plan-options\" with exactly 3 options (A/B/C).\nIf generating options, include requestedBlockFlow when the user explicitly specified stages.\nDo not omit the payload.`
          : requestContent;

      const reply = await chatWithAssistant({
        sessionId: activeSessionId,
        content: constrainedContent,
        mode: assistantRouteMode
      });
      const assistantContent =
        assistantRouteMode === "plan"
          ? await recoverStructuredPlanReply(activeSessionId, requestContent, reply.content)
          : reply.content;
      setMessages((prev) => [
        ...prev,
        {
          id: reply.id > 0 ? String(reply.id) : `local-assistant-${Date.now()}`,
          role: "assistant",
          content: assistantContent,
          createTime: reply.createTime
        }
      ]);
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : "Failed to send message to assistant.";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: `local-assistant-error-${Date.now()}`,
          role: "assistant",
          content: t(
            "assistant.unavailable",
            "The AI service is temporarily unavailable. Please try again shortly."
          )
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleDraftKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const materializeOptionExercisesIntoLibrary = async (option: PlanOptionCard) => {
    const rows =
      option.templateExercises && option.templateExercises.length > 0
        ? [...option.templateExercises].sort((a, b) => a.orderIndex - b.orderIndex)
        : (option.days ?? [])
            .flatMap((day) =>
              day.blocks.flatMap((block) =>
                block.items.map((item) => ({
                  ...item,
                  blockTitle: item.blockTitle || block.title,
                  blockType: item.blockType || block.type,
                  groupMethod: item.groupMethod || block.method,
                  dayName: item.dayName || day.dayName
                }))
              )
            )
            .sort((a, b) => a.orderIndex - b.orderIndex);
    if (rows.length === 0) return option;

    const createdByName = new Map<string, { id: number; name: string }>();
    const replacementsByOrder = new Map<number, { exerciseId: number; name: string }>();

    for (const row of rows) {
      const originalName = row.name?.trim() || "";
      const existingName = exerciseNameById.get(row.exerciseId)?.trim() || "";
      const hasMeaningfulName =
        originalName.length > 0 && isLikelyConcreteExerciseLabel(originalName);
      if (!hasMeaningfulName) {
        if (row.exerciseId > 0 && existingName) {
          replacementsByOrder.set(row.orderIndex, {
            exerciseId: row.exerciseId,
            name: existingName
          });
        }
        continue;
      }

      const shouldCreateCustom =
        row.exerciseId <= 0 ||
        (existingName.length > 0 && !areLikelySameExerciseName(originalName, existingName));
      if (!shouldCreateCustom) {
        continue;
      }

      const cacheKey = normalizeLookupText(originalName);
      const globalCached = cacheKey ? customExerciseCacheRef.current.get(cacheKey) : undefined;
      if (globalCached) {
        replacementsByOrder.set(row.orderIndex, {
          exerciseId: globalCached.id,
          name: globalCached.name
        });
        continue;
      }
      if (cacheKey && createdByName.has(cacheKey)) {
        const cached = createdByName.get(cacheKey);
        if (cached) {
          replacementsByOrder.set(row.orderIndex, {
            exerciseId: cached.id,
            name: cached.name
          });
        }
        continue;
      }

      const created = await createCustomExercise({
        name: originalName,
        primaryMuscle: inferPrimaryMuscleFromLabel(originalName),
        equipment: inferEquipmentFromLabel(originalName),
        difficulty: 2,
        description: `Auto-created from AI plan reconciliation: ${originalName}`
      });

      const newId = Number(created.id);
      const newName = created.name?.trim() || originalName;
      if (!Number.isFinite(newId) || newId <= 0) {
        continue;
      }

      if (cacheKey) {
        createdByName.set(cacheKey, { id: newId, name: newName });
        customExerciseCacheRef.current.set(cacheKey, { id: newId, name: newName });
      }
      replacementsByOrder.set(row.orderIndex, {
        exerciseId: Math.round(newId),
        name: newName
      });
    }

    if (replacementsByOrder.size <= 0) {
      return option;
    }

    const remapItem = (item: PlanTemplateExercise) => {
      const replacement = replacementsByOrder.get(item.orderIndex);
      if (!replacement) return item;
      return {
        ...item,
        exerciseId: replacement.exerciseId,
        name: replacement.name
      };
    };

    return {
      ...option,
      templateExercises: (option.templateExercises ?? []).map(remapItem),
      days: (option.days ?? []).map((day) => ({
        ...day,
        blocks: day.blocks.map((block) => ({
          ...block,
          items: block.items.map(remapItem)
        }))
      }))
    };
  };

  const handleSelectPlanOption = async (
    option: PlanOptionCard,
    payloadLanguage: "zh" | "en" | undefined,
    saveKind?: WorkoutTemplateKind
  ) => {
    const normalizedCode = option.code.trim().toUpperCase();
    if (!normalizedCode) return;
    const useChinese = payloadLanguage === "zh" || language === "zh";
    const planType = option.planKind === "module" ? "module" : "course";
    const safeTitle =
      option.title?.trim() ||
      option.code?.trim() ||
      (useChinese ? "AI训练安排" : "AI Training Plan");

    setError(null);
    setIsSending(true);
    try {
      const normalizedOption = await materializeOptionExercisesIntoLibrary(option);
      const reliableOption = keepReliablePlanOptions([normalizedOption], payloadLanguage)[0];
      if (!reliableOption) {
        throw new Error(
          useChinese
            ? "该方案动作重复度过高或参数异常，已自动拦截。请让AI重新生成更有针对性的方案。"
            : "This option was blocked due to low quality (repetition or abnormal parameters). Please regenerate."
        );
      }
      const executableRows = collectTemplateRowsFromOption(reliableOption);
      if (executableRows.length <= 0) {
        throw new Error(
          useChinese
            ? "方案中动作尚未完成映射，请先补全动作库映射后再应用。"
            : "Plan exercises are not fully mapped yet. Please complete exercise mapping first."
        );
      }
      const structure = buildDirectApplyStructureFromOption(reliableOption, payloadLanguage);
      const userId = resolveWorkoutUserId();
      const applyResult = await applyAssistantPlanDirect({
        userId,
        planType,
        style: inferWorkoutStyleFromOption(reliableOption),
        title: safeTitle,
        structure,
        applyTarget: "workout_builder",
        saveTemplate: Boolean(saveKind)
      });

      if (typeof window !== "undefined") {
        if (saveKind) {
          window.localStorage.removeItem("workoutApplySessionId");
        } else {
          window.localStorage.setItem("workoutApplySessionId", String(applyResult.sessionId));
          window.localStorage.setItem("workoutActiveSessionId", String(applyResult.sessionId));
          window.localStorage.setItem("workoutActiveUserId", String(userId));
          window.localStorage.removeItem("workoutActiveRunId");
          window.localStorage.removeItem("workoutActiveRunSessionId");
          window.localStorage.removeItem("quickModuleActive");
        }
      }

      const summary = saveKind
        ? useChinese
          ? `方案${normalizedCode}已应用，并已保存为${saveKind === "module" ? "Module" : "Course"}模板。`
          : `Option ${normalizedCode} applied and saved as a ${saveKind} template.`
        : useChinese
        ? `方案${normalizedCode}已应用，正在打开训练编排。`
        : `Option ${normalizedCode} applied. Opening workout builder.`;
      setMessages((prev) => [
        ...prev,
        {
          id: `local-assistant-apply-${Date.now()}`,
          role: "assistant",
          content: summary
        }
      ]);
      if (!saveKind) {
        navigate("/workout-builder");
      }
    } catch (applyError) {
      const message = useChinese
        ? `应用方案失败：${applyError instanceof Error ? applyError.message : "未知错误"}`
        : `Failed to apply plan: ${applyError instanceof Error ? applyError.message : "Unknown error"}`;
      setError(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenPlanInBuilder = async (
    option: PlanOptionCard,
    payloadLanguage: "zh" | "en" | undefined
  ) => {
    const useChinese = payloadLanguage === "zh" || language === "zh";
    try {
      const normalizedOption = await materializeOptionExercisesIntoLibrary(option);
      const reliableOption = keepReliablePlanOptions([normalizedOption], payloadLanguage)[0];
      if (!reliableOption) {
        throw new Error(
          useChinese
            ? "该方案动作重复度过高或参数异常，已自动拦截。请让AI重新生成更有针对性的方案。"
            : "This option was blocked due to low quality (repetition or abnormal parameters). Please regenerate."
        );
      }
      const executableRows = collectTemplateRowsFromOption(reliableOption);
      if (executableRows.length <= 0) {
        throw new Error(
          useChinese
            ? "方案中动作尚未完成映射，请先补全动作库映射后再预览。"
            : "Plan exercises are not fully mapped yet. Please finish exercise mapping before preview."
        );
      }
      if (reliableOption.planKind === "module") {
        writePlanOptionToQuickModuleDraft(reliableOption, payloadLanguage);
        navigate("/modules");
      } else {
        writePlanOptionToWorkoutBuilderDraft(reliableOption, payloadLanguage);
        navigate("/workout-builder");
      }
    } catch (builderError) {
      const message = useChinese
        ? `生成草稿失败：${builderError instanceof Error ? builderError.message : "未知错误"}`
        : `Failed to prepare draft: ${builderError instanceof Error ? builderError.message : "Unknown error"}`;
      setError(message);
    }
  };

  const handleChoosePlanScope = async (command: string) => {
    const trimmed = command.trim();
    if (!trimmed) return;
    await sendMessage(trimmed);
  };

  const handleUsePlanIntakeExample = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await sendMessage(trimmed);
  };

  const buildDefaultCandidateSelections = (payload: AnalysisReviewPayload) => {
    const selections: Record<number, number> = {};
    for (const candidate of payload.candidates) {
      const fallbackChoice =
        candidate.mappedExerciseId > 0
          ? candidate.mappedExerciseId
          : candidate.alternativeExercises[0]?.exerciseId ?? -1;
      selections[candidate.candidateId] = fallbackChoice;
    }
    return selections;
  };

  const resolveAnalysisReviewDraft = (cardKey: string, payload: AnalysisReviewPayload) =>
    analysisReviewDrafts[cardKey] ?? {
      planType: payload.suggestedPlanType,
      styleHint: payload.suggestedStyle || DEFAULT_WORKOUT_STYLE,
      candidateSelections: buildDefaultCandidateSelections(payload)
    };

  const updateAnalysisReviewDraft = (
    cardKey: string,
    payload: AnalysisReviewPayload,
    patch: Partial<AnalysisReviewDraftState>
  ) => {
    setAnalysisReviewDrafts((prev) => {
      const base = prev[cardKey] ?? {
        planType: payload.suggestedPlanType,
        styleHint: payload.suggestedStyle || DEFAULT_WORKOUT_STYLE,
        candidateSelections: buildDefaultCandidateSelections(payload)
      };
      return {
        ...prev,
        [cardKey]: {
          ...base,
          ...patch,
          candidateSelections: {
            ...base.candidateSelections,
            ...(patch.candidateSelections ?? {})
          }
        }
      };
    });
  };

  const handleGeneratePlansFromAnalysis = async (
    payload: AnalysisReviewPayload,
    cardKey: string
  ) => {
    const useChinese = payload.language === "zh" || language === "zh";
    const draftState = resolveAnalysisReviewDraft(cardKey, payload);
    const selectedPlanType = draftState.planType;
    const selectedStyle =
      draftState.styleHint.trim() || payload.suggestedStyle || DEFAULT_WORKOUT_STYLE;
    if (payload.candidateCount <= 0 || payload.requiredMaterial.length > 0) {
      throw new Error(
        useChinese
          ? "这个链接暂时没有解析到可靠动作内容，不能直接生成训练计划。需要可识别字幕、音频转写或清晰动作描述。"
          : "This link did not produce reliable movement content yet, so a source plan cannot be generated. Captions, audio transcript, or clear movement description is required."
      );
    }

    setError(null);
    setIsSending(true);
    try {
      const candidateUpdates: AssistantContentCandidateReviewUpdate[] = payload.candidates
        .map((candidate) => {
          const selectedExerciseId =
            draftState.candidateSelections[candidate.candidateId] ??
            (candidate.mappedExerciseId > 0
              ? candidate.mappedExerciseId
              : candidate.alternativeExercises[0]?.exerciseId ?? -1);

          if (selectedExerciseId === 0) {
            return {
              candidateId: candidate.candidateId,
              action: "reject" as const,
              notes: useChinese
                ? "未选择可用动作，候选被拒绝。"
                : "No usable exercise selected for this candidate."
            };
          }

          if (selectedExerciseId < 0) {
            return {
              candidateId: candidate.candidateId,
              action: "accept" as const,
              notes: useChinese
                ? "动作库未准确匹配，按视频片段自动新建动作后纳入计划。"
                : "No accurate library match; create a new exercise from the source clip and include it."
            };
          }

          if (candidate.mappedExerciseId > 0 && selectedExerciseId === candidate.mappedExerciseId) {
            return {
              candidateId: candidate.candidateId,
              action: "accept" as const,
              mappedExerciseId: selectedExerciseId
            };
          }

          return {
            candidateId: candidate.candidateId,
            action: "replace" as const,
            mappedExerciseId: selectedExerciseId
          };
        })
        .filter((item) => item.candidateId > 0);

      if (candidateUpdates.length > 0) {
        const acceptedCount = candidateUpdates.filter((item) => item.action !== "reject").length;
        if (acceptedCount <= 0) {
          throw new Error(
            useChinese
              ? "候选动作全部被拒绝，无法生成训练方案。请至少保留一个动作。"
              : "All candidates were rejected. Keep at least one exercise before generating plans."
          );
        }
        await reviewAssistantContentCandidates({
          jobId: payload.jobId,
          updates: candidateUpdates
        });
      }

      const planDrafts = await generateAssistantContentPlans({
        jobId: payload.jobId,
        planType: selectedPlanType,
        options: 1,
        styleHint: selectedStyle || undefined,
        userPrompt: [
          "LINK_SOURCE_RECONSTRUCTION: build one plan that follows the source video's demonstrated movements, order, and intent. Do not create A/B/C alternatives.",
          payload.summary,
          payload.textPreview,
          payload.segmentClues.length > 0 ? `Segments: ${payload.segmentClues.join(" / ")}` : ""
        ].filter(Boolean).join(" | "),
        generationMode: "source_reconstruction"
      });

      if (planDrafts.length === 0) {
        throw new Error(
          useChinese
            ? "解析完成，但暂时没有可用方案。你可以调整风格后重试。"
            : "Analysis completed, but no plans were generated. Try adjusting style and retry."
        );
      }

      const payloadLanguage: "zh" | "en" = useChinese ? "zh" : "en";
      const optionsPayload = buildPlanOptionsPayloadFromContentPlans(
        planDrafts,
        payloadLanguage,
        "source_reconstruction"
      );
      const reliableOptions = keepReliablePlanOptions(optionsPayload.options, payloadLanguage);
      if (reliableOptions.length === 0) {
        throw new Error(
          useChinese
            ? "生成结果被判定为低质量（动作重复或参数异常），已自动拦截。请调整目标/风格后重试。"
            : "Generated options were blocked as low quality (repetition or abnormal parameters). Adjust goal/style and retry."
        );
      }
      const normalizedReliableOptions = ensurePlanOptionsMinimum(reliableOptions, payloadLanguage);
      const hasExecutableRows = normalizedReliableOptions.some(
        (item) => collectTemplateRowsFromOption(item).length > 0
      );
      if (!hasExecutableRows) {
        throw new Error(
          useChinese
            ? "生成方案缺少可执行动作，请重新生成。"
            : "Generated options have no executable exercises. Please regenerate."
        );
      }
      const reliablePayload: PlanOptionsPayload = {
        ...optionsPayload,
        options: normalizedReliableOptions
      };

      const summaryText = useChinese
        ? `已根据视频内容生成1个“单次${selectedPlanType === "module" ? "快速模块" : "训练课"}”结构化方案（尽量按视频动作与顺序复刻）。先看细节，再确认应用。`
        : `Generated one source-based single-session ${selectedPlanType} plan from the video. Review details before applying.`;

      setMessages((prev) => [
        ...prev,
        {
          id: `local-assistant-plan-${Date.now()}`,
          role: "assistant",
          content: [
            summaryText,
            `${PLAN_PAYLOAD_START}${JSON.stringify(reliablePayload)}${PLAN_PAYLOAD_END}`
          ].join("\n")
        }
      ]);
    } catch (generateError) {
      const message =
        generateError instanceof Error
          ? generateError.message
          : useChinese
          ? "生成方案失败，请稍后再试。"
          : "Failed to generate plan options. Please try again later.";
      setError(message);
    } finally {
      setIsSending(false);
    }
  };

  const formatMessageTime = (value: string | undefined) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const renderModuleExercisePreviewCard = (exercise: PlanTemplateExercise, key: string) => {
    const safeSets = toSafePositiveInt(exercise.sets, 3);
    const safeReps = toSafePositiveInt(exercise.reps, 8);
    const safeRest = Math.max(0, toSafePositiveInt(exercise.restSeconds, 0));
    const safeTime = Math.max(0, toSafePositiveInt(exercise.timeSeconds, 0));
    const safeRounds = toSafePositiveInt(exercise.rounds, 1);
    const exerciseName = exercise.name?.trim() || `ID ${exercise.exerciseId}`;
    const imageUrl = exerciseImageById.get(Number(exercise.exerciseId)) ?? "";
    const mappedName = exerciseNameById.get(Number(exercise.exerciseId)) ?? "";
    const shouldShowImage =
      Boolean(imageUrl) && Boolean(mappedName) && areLikelySameExerciseName(exerciseName, mappedName);

    return (
      <div key={key} className="rounded-md border border-white/10 bg-white/[0.03] p-2">
        <p className="text-[11px] font-medium text-zinc-200">{exerciseName}</p>
        {shouldShowImage ? (
          <img
            src={imageUrl}
            alt={exerciseName}
            className="mt-1 h-20 w-full rounded border border-white/10 object-cover"
            loading="lazy"
          />
        ) : null}
        <div className="mt-1 flex flex-nowrap gap-1 overflow-x-auto pb-1 text-[10px] text-zinc-300 whitespace-nowrap">
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
    );
  };

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {isOpen && (
          <motion.section
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="w-[360px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-3xl border border-white/10 bg-[#07090d]/95 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-sky-400/10 via-emerald-300/10 to-transparent px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAssistantRouteMode((prev) => (prev === "plan" ? "qa" : "plan"));
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-sky-300/30 bg-sky-300/10 text-sky-200 transition hover:bg-sky-300/20"
                  title={
                    language === "zh"
                      ? "点击切换：训练编排 / 问答"
                      : "Click to switch: Plan / Q&A"
                  }
                >
                  <Bot className="h-4 w-4" />
                </button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white">
                    {routeTitle}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                    {routeSubtitle}
                  </p>
                </div>
                <div className="ml-1 flex items-center gap-1 rounded-lg border border-white/10 bg-black/25 p-1">
                  <button
                    type="button"
                    onClick={() => setAssistantRouteMode("plan")}
                    className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                      isPlanMode
                        ? "bg-emerald-300/25 text-emerald-100"
                        : "text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    {language === "zh" ? "编排" : "Plan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssistantRouteMode("qa")}
                    className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                      !isPlanMode
                        ? "bg-sky-300/25 text-sky-100"
                        : "text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    {language === "zh" ? "问答" : "Q&A"}
                  </button>
                </div>
                {isPlanMode ? (
                  <div className="ml-1 flex items-center gap-1 rounded-lg border border-white/10 bg-black/25 p-1">
                    <button
                      type="button"
                      onClick={() => setPlanEntryMode("auto")}
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                        planEntryMode === "auto"
                          ? "bg-violet-300/25 text-violet-100"
                          : "text-zinc-300 hover:bg-white/10"
                      }`}
                      title={language === "zh" ? "自动识别入口" : "Auto detect entry"}
                    >
                      {language === "zh" ? "自动" : "Auto"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanEntryMode("link")}
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                        planEntryMode === "link"
                          ? "bg-violet-300/25 text-violet-100"
                          : "text-zinc-300 hover:bg-white/10"
                      }`}
                      title={language === "zh" ? "仅短视频链接解析" : "Link analysis only"}
                    >
                      {language === "zh" ? "链接" : "Link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanEntryMode("nl")}
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                        planEntryMode === "nl"
                          ? "bg-violet-300/25 text-violet-100"
                          : "text-zinc-300 hover:bg-white/10"
                      }`}
                      title={language === "zh" ? "仅自然语言目标生成" : "Natural language only"}
                    >
                      {language === "zh" ? "目标" : "NL"}
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    handleStartNewSession();
                  }}
                  className="rounded-md border border-amber-300/35 bg-amber-300/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-100 hover:bg-amber-300/25"
                  title={language === "zh" ? "清空当前会话并新建" : "Reset current session and start fresh"}
                >
                  {language === "zh" ? "新会话" : "Reset"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                  aria-label={t("assistant.close", "Close assistant chat")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div ref={messagesRef} className="max-h-[320px] space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((item) => {
                const isUser = item.role === "user";
                const parsedPayload = !isUser
                  ? parseAssistantStructuredPayload(item.content)
                  : null;
                const visibleContent = isUser
                  ? item.content
                  : parsedPayload?.visibleContent ?? item.content;
                const shouldTryPlanPayload = !isUser && isPlanMode;
                const planPayload =
                  (shouldTryPlanPayload ? parsedPayload?.payload : null) ??
                  (!isUser && shouldTryPlanPayload && detectAssistantScopeQuestion(visibleContent)
                    ? (language === "zh"
                        ? ({
                            type: "plan-scope",
                            language: "zh",
                            question: "请选择本次计划类型",
                            choices: [
                              {
                                scope: "course",
                                title: "完整训练课",
                                description: "单次完整课程（约60-90分钟）",
                                command: "完整训练课"
                              },
                              {
                                scope: "module",
                                title: "快速模块",
                                description: "单次高效模块（约20-40分钟）",
                                command: "快速模块"
                              }
                            ]
                          } as PlanScopePayload)
                        : ({
                            type: "plan-scope",
                            language: "en",
                            question: "Select plan type",
                            choices: [
                              {
                                scope: "course",
                                title: "Full Course Session",
                                description: "Single complete session (60-90 min)",
                                command: "full course session"
                              },
                              {
                                scope: "module",
                                title: "Quick Module",
                                description: "Single focused module (20-40 min)",
                              command: "quick module"
                              }
                            ]
                          } as PlanScopePayload))
                    : !isUser && shouldTryPlanPayload
                    ? (() => {
                        const payloadLanguage: "zh" | "en" = language === "zh" ? "zh" : "en";
                        const fallbackPayload = buildFallbackPlanOptionsFromPlainText(
                          visibleContent,
                          payloadLanguage
                        );
                        if (!fallbackPayload) return null;
                        const reliableFallbackOptions = keepReliablePlanOptions(
                          fallbackPayload.options,
                          payloadLanguage
                        );
                        if (reliableFallbackOptions.length === 0) return null;
                        return {
                          ...fallbackPayload,
                          options: ensurePlanOptionsMinimum(
                            reliableFallbackOptions,
                            payloadLanguage
                          )
                        } as PlanOptionsPayload;
                      })()
                    : null);
                const shouldHidePlanNarrative =
                  !isUser &&
                  planPayload?.type === "plan-options" &&
                  Array.isArray(planPayload.options) &&
                  planPayload.options.length > 0;
                const isSourcePlanPayload =
                  shouldHidePlanNarrative &&
                  planPayload?.type === "plan-options" &&
                  planPayload.options.every((option) => isSourceReconstructionOption(option));
                const shouldRenderVisibleContent = Boolean(visibleContent) && !shouldHidePlanNarrative;
                return (
                  <div
                    key={item.id}
                    className={isUser ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={isUser
                        ? "max-w-[85%] rounded-2xl rounded-br-md border border-emerald-300/30 bg-emerald-300/15 px-3 py-2 text-sm text-emerald-50"
                        : "max-w-[85%] rounded-2xl rounded-bl-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100"
                      }
                    >
                      {!isUser && shouldHidePlanNarrative ? (
                        <p className="text-[11px] leading-relaxed text-zinc-300">
                          {isSourcePlanPayload
                            ? planPayload?.language === "zh"
                              ? "已生成视频训练计划卡，请查看源视频复刻细节后确认。"
                              : "Generated a source video plan card. Review the reconstructed details before confirming."
                            : planPayload?.language === "zh"
                            ? "已转为可视化方案卡，请直接查看并选择下方方案。"
                            : "Narrative converted to visual option cards. Review and choose below."}
                        </p>
                      ) : null}

                      {shouldRenderVisibleContent ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{visibleContent}</p>
                      ) : null}

                      {!isUser && planPayload?.type === "plan-scope" && (
                        <div className="mt-3 space-y-2 rounded-xl border border-sky-300/20 bg-sky-300/10 p-3">
                          <p className="text-xs font-semibold text-sky-100">
                            {planPayload.question || (planPayload.language === "zh" ? "请选择计划类型" : "Select plan type")}
                          </p>
                          <div className="grid gap-2">
                            {planPayload.choices.map((choice, index) => (
                              <button
                                key={`${item.id}-scope-${choice.scope}-${index}`}
                                type="button"
                                onClick={() => {
                                  void handleChoosePlanScope(choice.command);
                                }}
                                className="rounded-md border border-sky-300/35 bg-sky-300/15 px-3 py-2 text-left text-xs text-sky-50 hover:bg-sky-300/25"
                              >
                                <p className="font-semibold">{choice.title}</p>
                                {choice.description ? (
                                  <p className="mt-1 text-[11px] text-sky-100/90">{choice.description}</p>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {!isUser && planPayload?.type === "plan-intake" && (
                        <div className="mt-3 space-y-2 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3">
                          <p className="text-xs font-semibold text-amber-100">
                            {planPayload.question ||
                              (planPayload.language === "zh"
                                ? "先补全训练条件（器械/场地/频率/时长）"
                                : "Fill planning prerequisites first (equipment/environment/frequency/duration)")}
                          </p>
                          {planPayload.requiredFields.length > 0 && (
                            <p className="text-[11px] text-amber-100/90">
                              {(planPayload.language === "zh" ? "缺失项：" : "Missing: ") +
                                planPayload.requiredFields.join(" · ")}
                            </p>
                          )}
                          {planPayload.examples.length > 0 && (
                            <div className="grid gap-2">
                              {planPayload.examples.map((example, index) => (
                                <button
                                  key={`${item.id}-intake-${index}`}
                                  type="button"
                                  onClick={() => {
                                    void handleUsePlanIntakeExample(example.text);
                                  }}
                                  className="rounded-md border border-amber-300/35 bg-amber-300/15 px-3 py-2 text-left text-xs text-amber-50 hover:bg-amber-300/25"
                                >
                                  {example.text}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {!isUser && planPayload?.type === "analysis-review" && (() => {
                        const cardKey = `${item.id}-analysis-${planPayload.jobId}`;
                        const draftState = resolveAnalysisReviewDraft(cardKey, planPayload);
                        const styleOptions = Array.from(
                          new Set(
                            [
                              draftState.styleHint.trim(),
                              planPayload.suggestedStyle.trim(),
                              ...AVAILABLE_WORKOUT_STYLES
                            ].filter(Boolean)
                          )
                        );
                        const useChinese = planPayload.language === "zh" || language === "zh";
                        const sourceInsufficient =
                          planPayload.candidateCount <= 0 || planPayload.requiredMaterial.length > 0;
                        return (
                          <div className="mt-3 space-y-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-3">
                            <p className="text-xs font-semibold text-cyan-100">
                              {useChinese ? "解析确认：先核对，再生成" : "Analysis Review: confirm before generation"}
                            </p>
                            <p className="text-[11px] leading-relaxed text-cyan-50/90">
                              {planPayload.summary ||
                                (useChinese
                                  ? "已完成内容解析，请核对训练设置。"
                                  : "Content analysis completed. Please verify settings.")}
                            </p>
                            <p className="text-[11px] text-cyan-100/80">
                              {useChinese
                                ? `来源：${planPayload.sourcePlatform || "unknown"} · 候选动作 ${planPayload.candidateCount}`
                                : `Source: ${planPayload.sourcePlatform || "unknown"} · ${planPayload.candidateCount} candidates`}
                            </p>
                            {planPayload.unresolvedCount > 0 && (
                              <p className="text-[11px] text-amber-100/90">
                                {useChinese
                                  ? `待确认候选：${planPayload.unresolvedCount} 个`
                                  : `Candidates requiring review: ${planPayload.unresolvedCount}`}
                              </p>
                            )}
                            {planPayload.contentType ? (
                              <p className="text-[11px] text-cyan-100/80">
                                {useChinese
                                  ? `内容类型：${planPayload.contentType}`
                                  : `Content type: ${planPayload.contentType}`}
                              </p>
                            ) : null}
                            {planPayload.sourceUrl ? (
                              <p className="break-all text-[10px] text-cyan-100/70">
                                {planPayload.sourceUrl}
                              </p>
                            ) : null}
                            {planPayload.requiredMaterial.length > 0 ? (
                              <p className="text-[11px] text-amber-100/90">
                                {useChinese
                                  ? `建议补充素材：${planPayload.requiredMaterial.join(" / ")}`
                                  : `Suggested extra materials: ${planPayload.requiredMaterial.join(" / ")}`}
                              </p>
                            ) : null}
                            {planPayload.visualFrameCount > 0 ? (
                              <p className="text-[11px] text-cyan-100/80">
                                {useChinese
                                  ? `已抽取视觉关键帧：${planPayload.visualFrameCount} 张；识别到的动作会进入下方候选列表。`
                                  : `Visual keyframes extracted: ${planPayload.visualFrameCount}; recognized movements appear in the candidate list below.`}
                              </p>
                            ) : null}
                            {planPayload.visualFrames.length > 0 ? (
                              <div className="grid grid-cols-3 gap-1.5">
                                {planPayload.visualFrames.slice(0, 6).map((frame) => (
                                  <div
                                    key={`${cardKey}-frame-${frame.assetId}`}
                                    className="overflow-hidden rounded-lg border border-white/10 bg-black/30"
                                  >
                                    <img
                                      src={frame.previewUrl}
                                      alt={`video keyframe ${frame.assetId}`}
                                      className="h-16 w-full object-cover"
                                      loading="lazy"
                                    />
                                    <p className="px-1 py-0.5 text-[9px] text-cyan-100/70">
                                      {Math.round(frame.approxSec)}s
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {sourceInsufficient ? (
                              <p className="rounded-lg border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-[11px] leading-relaxed text-amber-50">
                                {useChinese
                                  ? "当前链接没有解析到可靠动作序列，系统不会再用模板动作假装生成。请换一个带讲解/字幕的视频，或等我们接入视觉关键帧识别后再试。"
                                  : "This link did not produce a reliable movement sequence. The system will not fake it with template exercises. Try a video with narration/captions, or retry after visual keyframe analysis is added."}
                              </p>
                            ) : null}

                            {planPayload.candidates.length > 0 ? (
                              <div className="space-y-2 rounded-lg border border-white/15 bg-black/25 p-2">
                                <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-300">
                                  {useChinese ? "候选动作确认" : "Candidate Mapping Review"}
                                </p>
                                {planPayload.candidates.map((candidate) => {
                                  const options = [
                                    ...(candidate.mappedExerciseId > 0 && candidate.mappedExerciseName
                                      ? [
                                          {
                                            exerciseId: candidate.mappedExerciseId,
                                            exerciseName: candidate.mappedExerciseName,
                                            matchScore: candidate.matchScore,
                                            mappingSource: "selected"
                                          }
                                        ]
                                      : []),
                                    ...candidate.alternativeExercises
                                  ].filter(
                                    (option, index, array) =>
                                      option.exerciseId > 0 &&
                                      option.exerciseName &&
                                      array.findIndex((item) => item.exerciseId === option.exerciseId) === index
                                  );
                                  const fallbackSelection =
                                    candidate.mappedExerciseId > 0
                                      ? candidate.mappedExerciseId
                                      : options[0]?.exerciseId ?? -1;
                                  const selectedExerciseId =
                                    draftState.candidateSelections[candidate.candidateId] ??
                                    fallbackSelection;
                                  return (
                                    <div
                                      key={`${cardKey}-candidate-${candidate.candidateId}`}
                                      className="rounded-md border border-white/10 bg-white/5 p-2"
                                    >
                                      <p className="text-[11px] font-semibold text-white">
                                        {candidate.label}
                                      </p>
                                      <p className="mt-1 text-[10px] text-zinc-300">
                                        {(useChinese ? "状态：" : "State: ") +
                                          (candidate.reviewState || (useChinese ? "pending" : "pending"))}
                                      </p>
                                      <div className="mt-1 space-y-1">
                                        <p className="text-[10px] text-zinc-300">
                                          {useChinese ? "映射动作" : "Mapped exercise"}
                                        </p>
                                        <select
                                          value={String(selectedExerciseId)}
                                          onChange={(event) => {
                                            const nextId = Number(event.target.value);
                                            updateAnalysisReviewDraft(cardKey, planPayload, {
                                              candidateSelections: {
                                                [candidate.candidateId]: Number.isFinite(nextId)
                                                  ? Math.max(0, Math.round(nextId))
                                                  : 0
                                              }
                                            });
                                          }}
                                            className="w-full rounded-md border border-white/15 bg-black/40 px-2 py-1 text-xs text-white outline-none focus:border-cyan-300/40"
                                        >
                                          <option value="-1">
                                            {useChinese
                                              ? "新建动作：按视频片段创建并纳入计划"
                                              : "Create new from video segment"}
                                          </option>
                                          {options.map((option) => (
                                            <option
                                              key={`${cardKey}-candidate-${candidate.candidateId}-option-${option.exerciseId}`}
                                              value={option.exerciseId}
                                            >
                                              {`#${option.exerciseId} · ${option.exerciseName}${
                                                option.matchScore > 0
                                                  ? ` (${Math.round(option.matchScore)})`
                                                  : ""
                                              }`}
                                            </option>
                                          ))}
                                          <option value="0">
                                            {useChinese ? "拒绝该候选（不纳入计划）" : "Reject this candidate"}
                                          </option>
                                        </select>
                                        {selectedExerciseId < 0 ? (
                                          <p className="mt-1 text-[10px] leading-relaxed text-amber-100/90">
                                            {useChinese
                                              ? "确认时会调用新增动作接口，优先截取该候选对应的视频片段作为动作素材；不会拿无关库内动作替代。"
                                              : "On confirm, the backend will call the custom exercise API and use this source segment when possible; it will not substitute an unrelated catalog exercise."}
                                          </p>
                                        ) : null}
                                      </div>
                                      {candidate.notes ? (
                                        <p className="mt-1 text-[10px] text-zinc-400">{candidate.notes}</p>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[11px] text-zinc-300">
                                {useChinese
                                  ? "未返回候选明细，生成前将由后端做候选校验。"
                                  : "Candidate details are unavailable. Backend validation will run before generation."}
                              </p>
                            )}

                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  updateAnalysisReviewDraft(cardKey, planPayload, { planType: "course" });
                                }}
                                className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                  draftState.planType === "course"
                                    ? "border-emerald-300/45 bg-emerald-300/25 text-emerald-50"
                                    : "border-white/20 bg-white/5 text-zinc-200 hover:bg-white/10"
                                }`}
                              >
                                {useChinese ? "完整训练课" : "Full Course"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateAnalysisReviewDraft(cardKey, planPayload, { planType: "module" });
                                }}
                                className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                  draftState.planType === "module"
                                    ? "border-emerald-300/45 bg-emerald-300/25 text-emerald-50"
                                    : "border-white/20 bg-white/5 text-zinc-200 hover:bg-white/10"
                                }`}
                              >
                                {useChinese ? "快速模块" : "Quick Module"}
                              </button>
                            </div>

                            <div className="space-y-1">
                              <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-300">
                                {useChinese ? "训练风格" : "Training style"}
                              </p>
                              <select
                                value={draftState.styleHint}
                                onChange={(event) => {
                                  updateAnalysisReviewDraft(cardKey, planPayload, {
                                    styleHint: event.target.value
                                  });
                                }}
                                className="w-full rounded-md border border-white/15 bg-black/40 px-2 py-1 text-xs text-white outline-none focus:border-cyan-300/40"
                              >
                                {styleOptions.map((styleOption) => (
                                  <option key={`${cardKey}-style-${styleOption}`} value={styleOption}>
                                    {styleOption}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {planPayload.focusTerms.length > 0 && (
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-300">
                                  {useChinese ? "重点" : "Focus"}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {planPayload.focusTerms.map((term, index) => (
                                    <span
                                      key={`${cardKey}-focus-${index}`}
                                      className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-200"
                                    >
                                      {term}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(planPayload.equipmentHints.length > 0 || planPayload.riskFlags.length > 0) && (
                              <div className="grid gap-2 md:grid-cols-2">
                                {planPayload.equipmentHints.length > 0 && (
                                  <p className="text-[11px] text-zinc-300">
                                    {(useChinese ? "器械提示：" : "Equipment: ") +
                                      planPayload.equipmentHints.join(" · ")}
                                  </p>
                                )}
                                {planPayload.riskFlags.length > 0 && (
                                  <p className="text-[11px] text-amber-100/90">
                                    {(useChinese ? "风险提示：" : "Risk flags: ") +
                                      planPayload.riskFlags.join(" · ")}
                                  </p>
                                )}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                void handleGeneratePlansFromAnalysis(planPayload, cardKey);
                              }}
                              disabled={isSending || isBootstrapping || sourceInsufficient}
                              className="w-full rounded-md border border-cyan-300/35 bg-cyan-300/20 px-3 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {useChinese ? "确认并生成视频计划" : "Confirm & Generate Source Plan"}
                            </button>
                          </div>
                        );
                      })()}

                      {!isUser && planPayload?.type === "plan-options" && (
                        <div className="mt-3 grid gap-2">
                          {planPayload.options.map((option) => {
                            const cardKey = `${item.id}-${option.code}`;
                            const expanded = expandedPlanCards[cardKey] ?? true;
                            const sourceLocked = isSourceReconstructionOption(option);
                            return (
                              <div
                                key={cardKey}
                                className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-2"
                              >
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
                                  {sourceLocked
                                    ? planPayload.language === "zh"
                                      ? "视频训练计划"
                                      : "Source Video Plan"
                                    : planPayload.language === "zh"
                                    ? `方案${option.code}`
                                    : `Option ${option.code}`}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-white">{option.title}</p>
                                <p className="mt-1 text-xs text-zinc-300">
                                  {(option.planKind === "module"
                                    ? planPayload.language === "zh"
                                      ? "快速模块"
                                      : "Quick Module"
                                    : planPayload.language === "zh"
                                    ? "完整训练课"
                                    : "Full Course") +
                                    " · " +
                                    (planPayload.language === "zh"
                                      ? `单次约 ${option.sessionMinutes} 分钟`
                                      : `Single session · ~${option.sessionMinutes} min`) +
                                    (sourceLocked
                                      ? planPayload.language === "zh"
                                        ? " · 按视频内容复刻"
                                        : " · source reconstruction"
                                      : "")}
                                </p>
                                {option.previewFocus ? (
                                  <p className="mt-1 text-xs text-zinc-400">{option.previewFocus}</p>
                                ) : null}
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExpandedPlanCards((prev) => ({
                                        ...prev,
                                        [cardKey]: !expanded
                                      }));
                                    }}
                                    className="rounded-md border border-violet-300/35 bg-violet-300/15 px-2 py-1 text-[11px] font-semibold text-violet-100 hover:bg-violet-300/25"
                                  >
                                    {expanded
                                      ? planPayload.language === "zh"
                                        ? "收起细节"
                                        : "Hide Details"
                                      : planPayload.language === "zh"
                                      ? "查看细节"
                                      : "View Details"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void handleSelectPlanOption(option, planPayload.language);
                                    }}
                                    className="rounded-md border border-emerald-300/35 bg-emerald-300/20 px-2 py-1 text-[11px] font-semibold text-emerald-50 hover:bg-emerald-300/30"
                                  >
                                    {planPayload.language === "zh" ? "确认方案" : "Confirm"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void handleOpenPlanInBuilder(option, planPayload.language);
                                    }}
                                    className="rounded-md border border-cyan-300/35 bg-cyan-300/15 px-2 py-1 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-300/25"
                                  >
                                    {option.planKind === "module"
                                      ? planPayload.language === "zh"
                                        ? "打开模块(仅预览)"
                                        : "Open Module (Preview)"
                                      : planPayload.language === "zh"
                                      ? "打开训练课编排(仅预览)"
                                      : "Open Course Builder (Preview)"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void handleSelectPlanOption(
                                        option,
                                        planPayload.language,
                                        option.planKind === "module" ? "module" : "course"
                                      );
                                    }}
                                    className="rounded-md border border-amber-300/35 bg-amber-300/15 px-2 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-300/25"
                                  >
                                    {option.planKind === "module"
                                      ? planPayload.language === "zh"
                                        ? "保存Module"
                                        : "Save Module"
                                      : planPayload.language === "zh"
                                      ? "保存Course"
                                      : "Save Course"}
                                  </button>
                                </div>

                                {expanded && option.days && option.days.length > 0 && (
                                  <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-black/25 p-2">
                                    {option.days.map((day, dayIndex) => (
                                      <div key={`${cardKey}-day-${dayIndex}`} className="rounded-md border border-white/10 bg-white/5 p-2">
                                        <p className="text-xs font-semibold text-white">{day.dayName}</p>
                                        {day.focus ? (
                                          <p className="text-[11px] text-zinc-300">{day.focus}</p>
                                        ) : null}
                                        <div className="mt-2 space-y-2">
                                          {day.blocks.map((block, blockIndex) => (
                                            <div key={`${cardKey}-day-${dayIndex}-block-${blockIndex}`} className="rounded-md border border-white/10 bg-black/30 p-2">
                                              <p className="text-[11px] font-semibold text-emerald-100">
                                                {block.title} · {block.method}
                                              </p>
                                              <div className="mt-1 space-y-1">
                                                {block.items.map((exercise, exerciseIndex) => {
                                                  const safeSets = toSafePositiveInt(exercise.sets, 3);
                                                  const safeReps = toSafePositiveInt(exercise.reps, 8);
                                                  const safeRest = Math.max(0, toSafePositiveInt(exercise.restSeconds, 0));
                                                  const safeTime = Math.max(0, toSafePositiveInt(exercise.timeSeconds, 0));
                                                  const safeRounds = toSafePositiveInt(exercise.rounds, 1);
                                                  const exerciseName = exercise.name?.trim() || `ID ${exercise.exerciseId}`;

                                                  if (option.planKind === "module") {
                                                    return renderModuleExercisePreviewCard(
                                                      exercise,
                                                      `${cardKey}-day-${dayIndex}-block-${blockIndex}-item-${exerciseIndex}`
                                                    );
                                                  }

                                                  return (
                                                    <p
                                                      key={`${cardKey}-day-${dayIndex}-block-${blockIndex}-item-${exerciseIndex}`}
                                                      className="text-[11px] text-zinc-300"
                                                    >
                                                      {exerciseName}
                                                      {` | ${safeSets}x${safeReps} | rest ${safeRest}s`}
                                                      {safeTime > 0 ? ` | work ${safeTime}s` : ""}
                                                      {` | rounds ${safeRounds}`}
                                                    </p>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                        {day.intervalProtocol ? (
                                          <p className="mt-2 text-[11px] text-zinc-400">{day.intervalProtocol}</p>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {expanded &&
                                  option.planKind === "module" &&
                                  (!option.days || option.days.length === 0) &&
                                  Array.isArray(option.templateExercises) &&
                                  option.templateExercises.length > 0 && (
                                    <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-black/25 p-2">
                                      {option.templateExercises
                                        .filter((exercise) => hasUsableExerciseRef(exercise))
                                        .sort((a, b) => {
                                          const aOrder = toSafePositiveInt(a.orderIndex, 9999);
                                          const bOrder = toSafePositiveInt(b.orderIndex, 9999);
                                          return aOrder - bOrder;
                                        })
                                        .map((exercise, exerciseIndex) =>
                                          renderModuleExercisePreviewCard(
                                            exercise,
                                            `${cardKey}-template-item-${exerciseIndex}`
                                          )
                                        )}
                                    </div>
                                  )}
                              </div>
                            );
                          })}
                          <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                            {planPayload.language === "zh"
                              ? "先看细节再确认；可继续对话要求微调"
                              : "Review details before confirming; ask for refinements anytime"}
                          </p>
                        </div>
                      )}

                      {!!item.createTime && (
                        <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                          {formatMessageTime(item.createTime)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {isBootstrapping && (
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("assistant.connecting", "Connecting assistant...")}
                </div>
              )}

              {isSending && (
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("assistant.thinking", "Assistant is thinking...")}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 bg-black/30 p-3">
              {error && (
                <p className="mb-2 text-[10px] uppercase tracking-[0.15em] text-rose-300">
                  {error}
                </p>
              )}

              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleDraftKeyDown}
                  rows={2}
                  placeholder={
                    isPlanMode
                      ? language === "zh"
                        ? "输入目标或粘贴视频链接（B站/小红书/抖音），将先确认：完整训练课 or 快速模块..."
                        : "Describe your goal or paste a video link (Bilibili/Xiaohongshu/Douyin). I will first confirm: Full Course or Quick Module..."
                      : language === "zh"
                      ? "提问动作、训练、康复问题（RAG问答）..."
                      : "Ask movement, training, or recovery questions (RAG Q&A)..."
                  }
                  className="min-h-[58px] flex-1 resize-none rounded-xl border border-white/10 bg-[#0f0f0f] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-sky-300/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    void sendMessage();
                  }}
                  disabled={!draft.trim() || isSending || isBootstrapping}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-300/30 bg-sky-300/15 text-sky-200 transition hover:bg-sky-300/25 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={t("assistant.send", "Send message")}
                >
                  <SendHorizontal className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative h-14 w-14 rounded-full border border-white/10 bg-zinc-900/70 shadow-[0_0_25px_rgba(56,189,248,0.35)] backdrop-blur"
        animate={floatAnimation}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        whileTap={{ scale: 0.96 }}
      >
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-400/70 via-emerald-300/40 to-transparent opacity-70"
          animate={{ opacity: mode === "training" ? 0.55 : 0.8 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute inset-[10px] rounded-full bg-black/50"
          animate={{ scale: isOpen ? 1.06 : 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
        />
        <div className="relative z-10 flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.3em] text-white">
          OS
        </div>
      </motion.button>
    </div>
  );
}

function LoginFloatingEntry() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  const maskAccountLabel = (rawAccount: string) => {
    const value = rawAccount.trim();
    if (!value) return t("account.user", "USER");

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

  const [isOpen, setIsOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
  });
  const resolveAccountLabel = (rawAccount: string, rawDisplayName: string) => {
    const displayName = rawDisplayName.trim();
    const account = rawAccount.trim();
    if (
      displayName &&
      !isSensitiveIdentity(displayName) &&
      (!account || displayName.toLowerCase() !== account.toLowerCase())
    ) {
      return displayName;
    }
    return maskAccountLabel(account || t("account.user", "USER"));
  };
  const [accountLabel, setAccountLabel] = useState(() => {
    if (typeof window === "undefined") return t("account.user", "USER");
    const rawAccount =
      window.localStorage.getItem("authAccount") || t("account.user", "USER");
    const rawDisplayName = window.localStorage.getItem(AUTH_DISPLAY_NAME_STORAGE_KEY) || "";
    return resolveAccountLabel(rawAccount, rawDisplayName);
  });

  useEffect(() => {
    const syncAuthState = () => {
      if (typeof window === "undefined") return;
      const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "";
      const rawAccount =
        window.localStorage.getItem("authAccount") || t("account.user", "USER");
      const rawDisplayName = window.localStorage.getItem(AUTH_DISPLAY_NAME_STORAGE_KEY) || "";
      setIsAuthed(Boolean(token));
      setAccountLabel(resolveAccountLabel(rawAccount, rawDisplayName));
    };

    syncAuthState();
    if (typeof window === "undefined") return;
    window.addEventListener("storage", syncAuthState);
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, syncAuthState);
    window.addEventListener("focus", syncAuthState);
    return () => {
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, syncAuthState);
      window.removeEventListener("focus", syncAuthState);
    };
  }, [location.pathname, t]);

  const handleSignOut = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("authAccount");
      window.localStorage.removeItem(AUTH_DISPLAY_NAME_STORAGE_KEY);
    }
    clearAuthToken();
    setIsOpen(false);
    navigate("/system/login");
  };

  return (
    <div className="fixed right-6 top-6 z-50">
      <div className="relative flex items-center gap-2">
        {isAuthed ? (
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.25em] text-white shadow-[0_0_20px_rgba(0,0,0,0.4)] backdrop-blur hover:bg-white/10"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {accountLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.25em] text-white shadow-[0_0_20px_rgba(0,0,0,0.4)] backdrop-blur hover:bg-white/10"
          >
            <LogIn className="h-4 w-4" />
            {t("account.login", "Login")}
          </button>
        )}

        {isOpen && (
          <div className="absolute right-0 top-12 w-64 rounded-2xl border border-white/10 bg-[#0f0f0f]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-400">
                {t("account.title", "Account")}
              </p>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {!isAuthed ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate("/system/login")}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-white hover:bg-white/10"
                  >
                    {t("account.loginRegister", "Login / Register")}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/system")}
                    className="w-full rounded-xl border border-[#c9b37d]/40 bg-[#c9b37d]/10 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-[#c9b37d] hover:bg-[#c9b37d]/20"
                  >
                    {t("account.startSystemFlow", "Start System Flow")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      navigate("/system/login");
                    }}
                    className="w-full rounded-xl bg-emerald-400 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-black hover:bg-emerald-300"
                  >
                    {t("account.openLogin", "Open Login Page")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => navigate("/athlete")}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-white hover:bg-white/10"
                  >
                    {t("account.profile", "Profile")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-rose-200 hover:bg-rose-400/20"
                  >
                    {t("account.signOut", "Sign Out")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LanguageFloatingEntry() {
  const { language, toggleLanguage, t } = useI18n();
  return (
    <div className="fixed left-6 top-6 z-50">
      <button
        type="button"
        onClick={toggleLanguage}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.22em] text-white shadow-[0_0_20px_rgba(0,0,0,0.4)] backdrop-blur hover:bg-white/10"
        aria-label={t("lang.label", "Language")}
        title={t("lang.label", "Language")}
      >
        <Languages className="h-4 w-4" />
        {t("lang.switch", language === "en" ? "中文" : "EN")}
      </button>
    </div>
  );
}

export function AppShell() {
  const { t } = useI18n();
  const location = useLocation();
  const isTraining = location.pathname.startsWith("/workout");
  const hideNav =
    location.pathname.startsWith("/exercise/") ||
    location.pathname.startsWith("/workout") ||
    location.pathname.startsWith("/system");

  return (
    <div className="min-h-screen bg-[#07090d] text-zinc-100">
      <div className={hideNav ? "pb-0" : "pb-28"}>
        <Outlet />
      </div>
      <LanguageFloatingEntry />
      <LoginFloatingEntry />
      <FloatingAvatarCompanion mode={isTraining ? "training" : "idle"} />

      {!hideNav && (
        <nav className="fixed bottom-6 left-1/2 z-50 w-full -translate-x-1/2 px-4">
          <div className="mx-auto flex w-full max-w-fit items-center gap-10 rounded-full border border-white/10 bg-white/[0.06] px-8 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            {navItems.map((item) => {
              const Icon = item.icon;
              const label = t(item.key, item.fallback);
              return (
                <NavLink
                  key={item.key}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      "flex flex-col items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.3em] transition-colors",
                      isActive ? "text-lime-300" : "text-zinc-400 hover:text-white"
                    ].join(" ")
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={[
                          "h-6 w-6 transition-colors",
                          isActive ? "text-lime-300" : "text-zinc-500"
                        ].join(" ")}
                      />
                      <span className="text-[9px] tracking-[0.25em]">{label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

