import { httpGet, httpPost } from "./http";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const readNumber = (source: UnknownRecord, keys: string[], fallback = 0) => {
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

const readString = (source: UnknownRecord, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
};

const readArray = (source: UnknownRecord, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

export type AssistantSessionData = {
  id: number;
  userId: number;
  title: string;
  status: number;
  createTime: string;
};

export type AssistantMessageData = {
  id: number;
  role: string;
  content: string;
  createTime: string;
};

export type GoalRadarMetric = {
  subject: string;
  score: number;
  fullMark: number;
};

export type GoalTargetMetric = {
  label: string;
  score: number;
  level: "Low" | "Med" | "High";
};

export type GoalSynthesisData = {
  summary: string;
  recommendation: string;
  radar: GoalRadarMetric[];
  targets: GoalTargetMetric[];
};

export type AssistantDirectApplyResult = {
  sessionId: number;
  templateId: number;
  status: string;
  note: string;
};

export type AssistantContentJob = {
  jobId: number;
  status: string;
  sourcePlatform: string;
  sourceUrl: string;
  requiredMaterial: string[];
  resultSummary: string;
  candidateCount: number;
  planCount: number;
  analysisResult: AssistantContentAnalysis | null;
};

export type AssistantContentPlanDraft = {
  planId: number;
  planType: "course" | "module";
  optionIndex: number;
  style: string;
  title: string;
  summary: string;
  statusLabel: string;
  structure: unknown;
};

export type AssistantContentAnalysis = {
  styleHint: string;
  contentType: string;
  planTypeHint: "course" | "module";
  focusTerms: string[];
  equipmentHints: string[];
  riskFlags: string[];
  segmentClues: string[];
  visualFrameCount: number;
  visualFrames: AssistantContentVisualFrame[];
  summary: string;
  textPreview: string;
};

export type AssistantContentVisualFrame = {
  assetId: number;
  approxSec: number;
  previewUrl: string;
};

export type AssistantContentCandidateAlternative = {
  exerciseId: number;
  exerciseName: string;
  matchScore: number;
  finalSelected: boolean;
  mappingSource: string;
};

export type AssistantContentCandidate = {
  candidateId: number;
  rawLabel: string;
  normalizedLabel: string;
  startSec: number;
  endSec: number;
  confidence: number;
  reviewState: string;
  notes: string;
  mappedExerciseId: number;
  mappedExerciseName: string;
  matchScore: number;
  finalSelected: boolean;
  alternativeExercises: AssistantContentCandidateAlternative[];
};

export type AssistantContentCandidateReviewUpdate = {
  candidateId: number;
  action: "accept" | "replace" | "reject";
  mappedExerciseId?: number;
  notes?: string;
};

export type AssistantContentCandidateReviewResult = {
  jobId: number;
  updatedCount: number;
  status: string;
};

const GOAL_RADAR_ORDER = [
  "Mobility",
  "Stability",
  "Control",
  "Strength",
  "Power",
  "Endurance"
] as const;

const GOAL_TARGET_ORDER = [
  "Hypertrophy",
  "Neural Adaptation",
  "Injury Rehab",
  "Metabolic Stress"
] as const;

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const scoreToLevel = (score: number): "Low" | "Med" | "High" => {
  if (score >= 70) return "High";
  if (score >= 45) return "Med";
  return "Low";
};

const normalizeRadarLabel = (raw: string) => {
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (key.includes("mobility") || key.includes("flexibility")) return "Mobility";
  if (key.includes("stability") || key.includes("balance")) return "Stability";
  if (key.includes("control") || key.includes("coordination")) return "Control";
  if (key.includes("strength")) return "Strength";
  if (key.includes("power") || key.includes("explosive")) return "Power";
  if (key.includes("endurance") || key.includes("metabolic") || key.includes("cardio")) {
    return "Endurance";
  }
  return "";
};

const normalizeTargetLabel = (raw: string) => {
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (key.includes("hypertrophy") || key.includes("muscle")) return "Hypertrophy";
  if (key.includes("neural") || key.includes("adaptation") || key.includes("skill")) {
    return "Neural Adaptation";
  }
  if (key.includes("injury") || key.includes("rehab") || key.includes("recovery")) {
    return "Injury Rehab";
  }
  if (key.includes("metabolic") || key.includes("conditioning") || key.includes("fatloss")) {
    return "Metabolic Stress";
  }
  return "";
};

const readScore = (raw: unknown) => {
  if (typeof raw === "number" && Number.isFinite(raw)) return clampScore(raw);
  if (typeof raw === "string") {
    const trimmed = raw.trim().toLowerCase();
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return clampScore(parsed);
    if (trimmed.includes("high")) return 82;
    if (trimmed.includes("med")) return 58;
    if (trimmed.includes("low")) return 32;
  }
  if (isRecord(raw)) {
    const direct = readNumber(raw, ["score", "value", "weight", "A", "a"], Number.NaN);
    if (Number.isFinite(direct)) return clampScore(direct);
    const level = readString(raw, ["level", "priority"], "").toLowerCase();
    if (level.includes("high")) return 82;
    if (level.includes("med")) return 58;
    if (level.includes("low")) return 32;
  }
  return Number.NaN;
};

const buildDefaultGoalSynthesis = (): GoalSynthesisData => {
  const radar = [
    { subject: "Mobility", score: 64, fullMark: 100 },
    { subject: "Stability", score: 60, fullMark: 100 },
    { subject: "Control", score: 62, fullMark: 100 },
    { subject: "Strength", score: 58, fullMark: 100 },
    { subject: "Power", score: 56, fullMark: 100 },
    { subject: "Endurance", score: 60, fullMark: 100 }
  ];
  const targets = [
    { label: "Hypertrophy", score: 66, level: "Med" as const },
    { label: "Neural Adaptation", score: 59, level: "Med" as const },
    { label: "Injury Rehab", score: 63, level: "Med" as const },
    { label: "Metabolic Stress", score: 58, level: "Med" as const }
  ];
  return {
    summary: "Primary objective emphasizes quality movement and progressive loading.",
    recommendation:
      "Start with controlled form blocks, then increase load only when alignment stays consistent.",
    radar,
    targets
  };
};

const normalizeGoalSynthesis = (raw: unknown): GoalSynthesisData => {
  const fallback = buildDefaultGoalSynthesis();
  const record = isRecord(raw) ? raw : {};

  const summary = readString(record, ["summary", "overview", "analysis"], fallback.summary);
  const recommendation = readString(
    record,
    ["recommendation", "focus", "coaching"],
    fallback.recommendation
  );

  const radarScores = new Map<string, number>(
    GOAL_RADAR_ORDER.map((item, index) => [item, fallback.radar[index]?.score ?? 60])
  );
  const targetScores = new Map<string, number>(
    GOAL_TARGET_ORDER.map((item, index) => [item, fallback.targets[index]?.score ?? 50])
  );

  const mergeRadarFromRecord = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) {
        if (!isRecord(item)) continue;
        const label = normalizeRadarLabel(readString(item, ["subject", "label", "name", "key"], ""));
        if (!label) continue;
        const score = readScore(item);
        if (Number.isFinite(score)) radarScores.set(label, clampScore(score));
      }
      return;
    }
    if (isRecord(node)) {
      for (const [key, value] of Object.entries(node)) {
        const label = normalizeRadarLabel(key);
        if (!label) continue;
        const score = readScore(value);
        if (Number.isFinite(score)) radarScores.set(label, clampScore(score));
      }
    }
  };

  const mergeTargetFromRecord = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) {
        if (!isRecord(item)) continue;
        const label = normalizeTargetLabel(readString(item, ["label", "name", "subject", "key"], ""));
        if (!label) continue;
        const score = readScore(item);
        if (Number.isFinite(score)) targetScores.set(label, clampScore(score));
      }
      return;
    }
    if (isRecord(node)) {
      for (const [key, value] of Object.entries(node)) {
        const label = normalizeTargetLabel(key);
        if (!label) continue;
        const score = readScore(value);
        if (Number.isFinite(score)) targetScores.set(label, clampScore(score));
      }
    }
  };

  mergeRadarFromRecord(record);
  mergeRadarFromRecord(record.radar);
  mergeRadarFromRecord(record.radar_scores);
  mergeTargetFromRecord(record);
  mergeTargetFromRecord(record.targets);
  mergeTargetFromRecord(record.weights);

  const radar: GoalRadarMetric[] = GOAL_RADAR_ORDER.map((subject) => ({
    subject,
    score: clampScore(radarScores.get(subject) ?? 0),
    fullMark: 100
  }));

  const targets: GoalTargetMetric[] = GOAL_TARGET_ORDER.map((label) => {
    const score = clampScore(targetScores.get(label) ?? 0);
    return {
      label,
      score,
      level: scoreToLevel(score)
    };
  });

  return {
    summary,
    recommendation,
    radar,
    targets
  };
};

const normalizeSession = (raw: unknown): AssistantSessionData => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: readNumber(record, ["id"], 0),
    userId: readNumber(record, ["userId", "user_id"], 0),
    title: readString(record, ["title"], "Coach"),
    status: readNumber(record, ["status"], 1),
    createTime: readString(record, ["createTime", "create_time"], "")
  };
};

const normalizeMessage = (raw: unknown): AssistantMessageData => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: readNumber(record, ["id"], 0),
    role: readString(record, ["role"], "assistant"),
    content: readString(record, ["content"], ""),
    createTime: readString(record, ["createTime", "create_time"], "")
  };
};

const normalizeDirectApplyResult = (raw: unknown): AssistantDirectApplyResult => {
  const record = isRecord(raw) ? raw : {};
  return {
    sessionId: readNumber(record, ["sessionId", "session_id"], 0),
    templateId: readNumber(record, ["templateId", "template_id"], 0),
    status: readString(record, ["status"], ""),
    note: readString(record, ["note", "message"], "")
  };
};

const normalizeContentJob = (raw: unknown): AssistantContentJob => {
  const record = isRecord(raw) ? raw : {};
  const parseStringArray = (node: unknown) => {
    if (!Array.isArray(node)) return [];
    return node
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const parseVisualFrames = (node: unknown, jobId: number): AssistantContentVisualFrame[] => {
    if (!Array.isArray(node) || jobId <= 0) return [];
    return node
      .map((item) => (isRecord(item) ? item : {}))
      .map((record) => {
        const assetId = Math.max(
          0,
          Math.round(readNumber(record, ["assetId", "asset_id", "id"], 0))
        );
        const approxSec = Math.max(
          0,
          readNumber(record, ["approxSec", "approx_sec", "durationSec", "duration_sec"], 0)
        );
        return {
          assetId,
          approxSec,
          previewUrl:
            assetId > 0
              ? `/api/v1/assistant/content/jobs/${jobId}/assets/${assetId}/file`
              : ""
        };
      })
      .filter((item) => item.assetId > 0 && item.previewUrl)
      .slice(0, 12);
  };

  const jobId = readNumber(record, ["jobId", "job_id", "id"], 0);

  const parseAnalysisResult = (node: unknown): AssistantContentAnalysis | null => {
    let parsed: unknown = node;
    if (typeof parsed === "string") {
      const text = parsed.trim();
      if (!text) return null;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        return null;
      }
    }
    if (!isRecord(parsed)) return null;

    const planTypeHintRaw = readString(
      parsed,
      ["planTypeHint", "plan_type_hint", "goalTypeHint", "goal_type_hint"],
      "course"
    ).toLowerCase();

    return {
      styleHint: readString(parsed, ["styleHint", "style_hint", "style"], ""),
      contentType: readString(parsed, ["contentType", "content_type"], ""),
      planTypeHint: planTypeHintRaw === "module" ? "module" : "course",
      focusTerms: parseStringArray(parsed.focus_terms ?? parsed.focusTerms),
      equipmentHints: parseStringArray(parsed.equipment_hints ?? parsed.equipmentHints),
      riskFlags: parseStringArray(parsed.risk_flags ?? parsed.riskFlags),
      segmentClues: parseStringArray(parsed.segment_clues ?? parsed.segmentClues),
      visualFrameCount: Math.max(
        0,
        readNumber(parsed, ["visualFrameCount", "visual_frame_count"], 0)
      ),
      visualFrames: parseVisualFrames(parsed.visualFrames ?? parsed.visual_frames, jobId),
      summary: readString(parsed, ["summary"], ""),
      textPreview: readString(parsed, ["textPreview", "text_preview"], "")
    };
  };

  const analysisResult =
    parseAnalysisResult(record.analysisResultJson ?? record.analysis_result_json) ??
    parseAnalysisResult(record.analysisResult ?? record.analysis_result);
  return {
    jobId,
    status: readString(record, ["status", "pipelineStatus", "pipeline_status"], ""),
    sourcePlatform: readString(record, ["sourcePlatform", "source_platform"], ""),
    sourceUrl: readString(record, ["sourceUrl", "source_url"], ""),
    requiredMaterial: readArray(record, ["requiredMaterial", "required_material"])
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean),
    resultSummary: readString(record, ["resultSummary", "result_summary"], ""),
    candidateCount: Math.max(
      0,
      readNumber(record, ["candidateCount", "candidate_count"], 0)
    ),
    planCount: Math.max(0, readNumber(record, ["planCount", "plan_count"], 0)),
    analysisResult
  };
};

const normalizeContentPlanDraft = (raw: unknown): AssistantContentPlanDraft => {
  const record = isRecord(raw) ? raw : {};
  const planTypeRaw = readString(record, ["planType", "plan_type"], "course").toLowerCase();
  return {
    planId: readNumber(record, ["planId", "plan_id", "id"], 0),
    planType: planTypeRaw === "module" ? "module" : "course",
    optionIndex: readNumber(record, ["optionIndex", "option_index"], 0),
    style: readString(record, ["style"], ""),
    title: readString(record, ["title"], ""),
    summary: readString(record, ["summary"], ""),
    statusLabel: readString(record, ["statusLabel", "status_label"], ""),
    structure: record.structure ?? record.plan ?? null
  };
};

const normalizeContentCandidateAlternative = (
  raw: unknown
): AssistantContentCandidateAlternative => {
  const record = isRecord(raw) ? raw : {};
  return {
    exerciseId: readNumber(record, ["exerciseId", "exercise_id", "id"], 0),
    exerciseName: readString(record, ["exerciseName", "exercise_name", "name"], ""),
    matchScore: Math.max(0, readNumber(record, ["matchScore", "match_score"], 0)),
    finalSelected: readNumber(record, ["finalSelected", "final_selected"], 0) > 0,
    mappingSource: readString(record, ["mappingSource", "mapping_source"], "")
  };
};

const normalizeContentCandidate = (raw: unknown): AssistantContentCandidate => {
  const record = isRecord(raw) ? raw : {};
  const alternatives = readArray(record, ["alternativeExercises", "alternative_exercises"])
    .map(normalizeContentCandidateAlternative)
    .filter((item) => item.exerciseId > 0 && item.exerciseName);
  return {
    candidateId: readNumber(record, ["candidateId", "candidate_id", "id"], 0),
    rawLabel: readString(record, ["rawLabel", "raw_label"], ""),
    normalizedLabel: readString(record, ["normalizedLabel", "normalized_label"], ""),
    startSec: Math.max(0, readNumber(record, ["startSec", "start_sec"], 0)),
    endSec: Math.max(0, readNumber(record, ["endSec", "end_sec"], 0)),
    confidence: Math.max(0, readNumber(record, ["confidence"], 0)),
    reviewState: readString(record, ["reviewState", "review_state"], ""),
    notes: readString(record, ["notes"], ""),
    mappedExerciseId: readNumber(record, ["mappedExerciseId", "mapped_exercise_id"], 0),
    mappedExerciseName: readString(
      record,
      ["mappedExerciseName", "mapped_exercise_name"],
      ""
    ),
    matchScore: Math.max(0, readNumber(record, ["matchScore", "match_score"], 0)),
    finalSelected: readNumber(record, ["finalSelected", "final_selected"], 0) > 0,
    alternativeExercises: alternatives
  };
};

const normalizeContentCandidateReviewResult = (
  raw: unknown
): AssistantContentCandidateReviewResult => {
  const record = isRecord(raw) ? raw : {};
  return {
    jobId: readNumber(record, ["jobId", "job_id"], 0),
    updatedCount: Math.max(0, readNumber(record, ["updatedCount", "updated_count"], 0)),
    status: readString(record, ["status"], "")
  };
};

export const createAssistantSession = async (userId: number, title = "Coach") => {
  const data = await httpPost<unknown>("/api/v1/assistant/session", {
    userId,
    user_id: userId,
    title
  });
  const session = normalizeSession(data);
  if (!session.id) {
    throw new Error("Assistant session was created without an id.");
  }
  return session;
};

export const fetchAssistantSession = async (sessionId: number) => {
  const data = await httpGet<unknown>(`/api/v1/assistant/session/${sessionId}`);
  const session = normalizeSession(data);
  if (!session.id) {
    throw new Error("Assistant session not found.");
  }
  return session;
};

export const fetchAssistantMessages = async (sessionId: number) => {
  const data = await httpGet<unknown>(`/api/v1/assistant/messages?session_id=${sessionId}`);
  const list = Array.isArray(data)
    ? data
    : isRecord(data)
    ? readArray(data, ["list", "items", "records"])
    : [];
  return list
    .map(normalizeMessage)
    .filter((item) => item.id > 0 && item.content);
};

export const chatWithAssistant = async (payload: {
  sessionId: number;
  content: string;
  mode?: "plan" | "qa" | "auto";
}) => {
  const data = await httpPost<unknown>("/api/v1/assistant/chat", {
    sessionId: payload.sessionId,
    session_id: payload.sessionId,
    content: payload.content,
    mode: payload.mode
  });
  const message = normalizeMessage(data);
  if (!message.content) {
    throw new Error("Assistant returned empty content.");
  }
  return message;
};

export const synthesizeGoal = async (payload: {
  userId: number;
  goalInput: string;
  lifestyleProfile?: string;
}) => {
  const data = await httpPost<unknown>("/api/v1/assistant/goal-synthesis", {
    userId: payload.userId,
    user_id: payload.userId,
    goalInput: payload.goalInput,
    goal_input: payload.goalInput,
    lifestyleProfile: payload.lifestyleProfile,
    lifestyle_profile: payload.lifestyleProfile
  });
  return normalizeGoalSynthesis(data);
};

export const applyAssistantPlanDirect = async (payload: {
  userId: number;
  planType: "course" | "module";
  style: string;
  title: string;
  structure: unknown;
  applyTarget?: string;
  saveTemplate?: boolean;
}) => {
  const data = await httpPost<unknown>("/api/v1/assistant/content/plans/apply-direct", {
    userId: payload.userId,
    user_id: payload.userId,
    planType: payload.planType,
    plan_type: payload.planType,
    style: payload.style,
    title: payload.title,
    structure: payload.structure,
    applyTarget: payload.applyTarget ?? "workout_builder",
    apply_target: payload.applyTarget ?? "workout_builder",
    saveTemplate: payload.saveTemplate ?? false,
    save_template: payload.saveTemplate ?? false
  });
  const normalized = normalizeDirectApplyResult(data);
  if (!normalized.sessionId) {
    throw new Error("Assistant plan apply succeeded but session id is missing.");
  }
  return normalized;
};

export const createAssistantContentJob = async (payload: {
  userId: number;
  sourceUrl: string;
  goalType?: "course" | "module";
  analysisMode?: string;
  userConstraints?: Record<string, unknown>;
}) => {
  const data = await httpPost<unknown>("/api/v1/assistant/content/jobs", {
    userId: payload.userId,
    user_id: payload.userId,
    sourceUrl: payload.sourceUrl,
    source_url: payload.sourceUrl,
    goalType: payload.goalType,
    goal_type: payload.goalType,
    analysisMode: payload.analysisMode ?? "auto",
    analysis_mode: payload.analysisMode ?? "auto",
    userConstraints: payload.userConstraints,
    user_constraints: payload.userConstraints
  });
  const normalized = normalizeContentJob(data);
  if (!normalized.jobId) {
    throw new Error("Content job was created without a job id.");
  }
  return normalized;
};

export const startAssistantContentAnalyze = async (jobId: number) => {
  const data = await httpPost<unknown>(`/api/v1/assistant/content/jobs/${jobId}/analyze`);
  const normalized = normalizeContentJob(data);
  if (!normalized.jobId) {
    throw new Error("Content analyze completed but job payload is missing.");
  }
  return normalized;
};

export const fetchAssistantContentJob = async (jobId: number) => {
  const data = await httpGet<unknown>(`/api/v1/assistant/content/jobs/${jobId}`);
  const normalized = normalizeContentJob(data);
  if (!normalized.jobId) {
    throw new Error("Content job not found.");
  }
  return normalized;
};

export const fetchAssistantContentCandidates = async (jobId: number) => {
  const data = await httpGet<unknown>(`/api/v1/assistant/content/jobs/${jobId}/candidates`);
  const list = Array.isArray(data)
    ? data
    : isRecord(data)
    ? readArray(data, ["list", "items", "records", "candidates"])
    : [];
  return list
    .map(normalizeContentCandidate)
    .filter((item) => item.candidateId > 0);
};

export const reviewAssistantContentCandidates = async (payload: {
  jobId: number;
  updates: AssistantContentCandidateReviewUpdate[];
}) => {
  if (!Array.isArray(payload.updates) || payload.updates.length === 0) {
    throw new Error("Candidate review updates cannot be empty.");
  }
  const updates = payload.updates.map((item) => ({
    candidateId: item.candidateId,
    candidate_id: item.candidateId,
    action: item.action,
    mappedExerciseId: item.mappedExerciseId,
    mapped_exercise_id: item.mappedExerciseId,
    notes: item.notes
  }));
  const data = await httpPost<unknown>(
    `/api/v1/assistant/content/jobs/${payload.jobId}/candidates/review`,
    { updates }
  );
  const normalized = normalizeContentCandidateReviewResult(data);
  if (!normalized.jobId) {
    throw new Error("Candidate review failed: invalid response.");
  }
  return normalized;
};

export const generateAssistantContentPlans = async (payload: {
  jobId: number;
  planType: "course" | "module";
  options?: number;
  styleHint?: string;
  userPrompt?: string;
  generationMode?: "source_reconstruction" | "options";
}) => {
  const data = await httpPost<unknown>(
    `/api/v1/assistant/content/jobs/${payload.jobId}/plans/generate`,
    {
      planType: payload.planType,
      plan_type: payload.planType,
      options: payload.options ?? 3,
      styleHint: payload.styleHint,
      style_hint: payload.styleHint,
      userPrompt: payload.userPrompt,
      user_prompt: payload.userPrompt,
      generationMode: payload.generationMode,
      generation_mode: payload.generationMode
    }
  );
  const list = Array.isArray(data)
    ? data
    : isRecord(data)
    ? readArray(data, ["list", "items", "records", "plans"])
    : [];
  return list
    .map(normalizeContentPlanDraft)
    .filter((item) => item.planId > 0 || item.title || item.structure);
};
