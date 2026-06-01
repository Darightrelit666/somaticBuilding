export const GOAL_RADAR_SUBJECTS = [
  "Mobility",
  "Stability",
  "Control",
  "Strength",
  "Power",
  "Endurance"
] as const;

export type GoalRadarSubject = (typeof GOAL_RADAR_SUBJECTS)[number];

export type GoalRadarDatum = {
  subject: GoalRadarSubject;
  A: number;
  fullMark: 100;
};

export type GoalRadarAnalysisInput = {
  summary?: string | null;
  readiness?: string | null;
  focus?: string[] | null;
  risks?: string[] | null;
} | null;

const GOAL_RADAR_BASELINE: Record<GoalRadarSubject, number> = {
  Mobility: 62,
  Stability: 60,
  Control: 64,
  Strength: 58,
  Power: 52,
  Endurance: 59
};

const GOAL_RADAR_KEYWORDS: Record<GoalRadarSubject, Array<[string, number]>> = {
  Mobility: [
    ["mobility", 14],
    ["flexibility", 12],
    ["range of motion", 12],
    ["rom", 10],
    ["rehab", 10],
    ["活动度", 16],
    ["灵活性", 14],
    ["拉伸", 8],
    ["康复", 10]
  ],
  Stability: [
    ["stability", 15],
    ["balance", 13],
    ["single-leg", 10],
    ["core", 8],
    ["injury", 6],
    ["pain", 5],
    ["稳定", 16],
    ["平衡", 13],
    ["核心", 10],
    ["损伤", 8]
  ],
  Control: [
    ["control", 14],
    ["technique", 12],
    ["form", 12],
    ["quality", 10],
    ["movement quality", 12],
    ["动作质量", 16],
    ["控制", 14],
    ["技术", 12]
  ],
  Strength: [
    ["strength", 16],
    ["hypertrophy", 12],
    ["squat", 10],
    ["deadlift", 10],
    ["bench", 10],
    ["1rm", 14],
    ["力量", 16],
    ["增肌", 12],
    ["深蹲", 10],
    ["硬拉", 10],
    ["卧推", 10],
    ["三大项", 16]
  ],
  Power: [
    ["power", 16],
    ["explosive", 14],
    ["jump", 12],
    ["sprint", 12],
    ["plyometric", 12],
    ["爆发", 16],
    ["爆发力", 16],
    ["弹跳", 12],
    ["冲刺", 12]
  ],
  Endurance: [
    ["endurance", 16],
    ["conditioning", 14],
    ["cardio", 14],
    ["aerobic", 12],
    ["fatigue", 8],
    ["耐力", 16],
    ["有氧", 14],
    ["心肺", 14],
    ["体能", 10],
    ["减脂", 12]
  ]
};

const GOAL_RADAR_INJURY_KEYWORDS = [
  "injury",
  "pain",
  "rehab",
  "surgery",
  "hurt",
  "risk",
  "受伤",
  "损伤",
  "疼",
  "疼痛",
  "康复",
  "手术",
  "突出"
];

const GOAL_RADAR_READINESS_TUNING: Record<string, Partial<Record<GoalRadarSubject, number>>> = {
  FOUNDATION: {
    Mobility: 8,
    Stability: 8,
    Control: 8,
    Strength: -3,
    Power: -5,
    Endurance: 3
  },
  BUILD: {
    Mobility: 4,
    Stability: 4,
    Control: 5,
    Strength: 6,
    Power: 4,
    Endurance: 4
  },
  ADVANCE: {
    Mobility: 2,
    Stability: 3,
    Control: 4,
    Strength: 8,
    Power: 9,
    Endurance: 5
  }
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const countKeywordHits = (source: string, keyword: string) => {
  if (!source || !keyword) return 0;
  const matches = source.match(new RegExp(escapeRegExp(keyword), "gi"));
  return matches ? matches.length : 0;
};

const clampRadarScore = (value: number) => Math.max(28, Math.min(96, Math.round(value)));

export const buildGoalRadarData = (
  goal: string,
  analysis: GoalRadarAnalysisInput
): GoalRadarDatum[] => {
  const goalCorpus = goal.trim().toLowerCase();
  const scores: Record<GoalRadarSubject, number> = { ...GOAL_RADAR_BASELINE };

  GOAL_RADAR_SUBJECTS.forEach((subject) => {
    const keywordScore = GOAL_RADAR_KEYWORDS[subject].reduce(
      (sum, [keyword, weight]) => sum + countKeywordHits(goalCorpus, keyword) * weight,
      0
    );
    scores[subject] += Math.min(30, keywordScore);
  });

  const injuryHits = GOAL_RADAR_INJURY_KEYWORDS.reduce(
    (sum, keyword) => sum + countKeywordHits(goalCorpus, keyword),
    0
  );
  if (injuryHits > 0) {
    const penaltyScale = Math.min(10, injuryHits * 2);
    scores.Mobility += 6 + penaltyScale * 0.4;
    scores.Stability += 6 + penaltyScale * 0.5;
    scores.Control += 4 + penaltyScale * 0.5;
    scores.Power -= 4 + penaltyScale * 0.5;
  }

  if (analysis) {
    const focusText = Array.isArray(analysis.focus) ? analysis.focus.join(" ") : "";
    const riskText = Array.isArray(analysis.risks) ? analysis.risks.join(" ") : "";
    const analysisCorpus = [
      analysis.summary ?? "",
      analysis.readiness ?? "",
      focusText,
      riskText
    ]
      .join(" ")
      .toLowerCase();

    GOAL_RADAR_SUBJECTS.forEach((subject) => {
      const analysisScore = GOAL_RADAR_KEYWORDS[subject].reduce(
        (sum, [keyword, weight]) => sum + countKeywordHits(analysisCorpus, keyword) * weight * 0.45,
        0
      );
      scores[subject] += Math.min(14, analysisScore);
    });

    const readinessKey = (analysis.readiness ?? "").trim().toUpperCase();
    const readinessAdjustments = GOAL_RADAR_READINESS_TUNING[readinessKey];
    if (readinessAdjustments) {
      GOAL_RADAR_SUBJECTS.forEach((subject) => {
        scores[subject] += readinessAdjustments[subject] ?? 0;
      });
    }
  }

  return GOAL_RADAR_SUBJECTS.map((subject) => ({
    subject,
    A: clampRadarScore(scores[subject]),
    fullMark: 100
  }));
};
