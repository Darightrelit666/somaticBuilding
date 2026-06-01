const narrativeExerciseLabelPatterns = [
  /为了|我们将|采用|目标|通过|提高|发展|所需|方案|阶段|安排|建议|注意|适合|用于|帮助/,
  /\b(goal|objective|target|rationale|reason|phase|block|plan|program|session|training\s+plan)\b/i,
  /\b(designed\s+to|we\s+will|in\s+order\s+to|because|therefore|focus(?:es)?\s+on|prioritizes?)\b/i
];

export const isGenericExercisePlaceholderName = (value: string) =>
  /^exercise\s*#\d+$/i.test(value.trim()) || /^动作\s*#?\d+$/i.test(value.trim());

export const isNarrativeExerciseLabel = (value: string) => {
  const label = value.trim();
  if (!label) return true;
  if (/[。！？；;]|(?:^|\s)[\-–—]{2,}(?:\s|$)/.test(label)) return true;
  return narrativeExerciseLabelPatterns.some((pattern) => pattern.test(label));
};

export const isConcreteExerciseLabelCandidate = (value: string) => {
  const label = value.trim();
  if (!label || isGenericExercisePlaceholderName(label)) return false;
  if (isNarrativeExerciseLabel(label)) return false;

  const normalized = label
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;

  const wordCount = normalized.split(" ").filter(Boolean).length;
  const cjkCount = (label.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  if (label.length > 64) return false;
  if (wordCount > 8) return false;
  if (cjkCount > 18 && /[，,、]/.test(label)) return false;
  return true;
};
