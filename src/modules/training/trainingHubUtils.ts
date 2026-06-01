import type { WorkoutTemplateExercise } from "../../shared/api/workout";

export const DEMO_WORKOUT_USER_ID = 1;

const USER_ID_KEYS = [
  "workoutActiveUserId",
  "userId",
  "user_id",
  "authUserId",
  "auth_user_id"
];

export const resolveWorkoutUserId = () => {
  if (typeof window === "undefined") {
    return DEMO_WORKOUT_USER_ID;
  }
  for (const key of USER_ID_KEYS) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEMO_WORKOUT_USER_ID;
};

export const estimateTemplateDurationMinutes = (
  exercises: WorkoutTemplateExercise[]
) => {
  if (!exercises.length) return 5;
  const totalSeconds = exercises.reduce((acc, item) => {
    const perSetWork =
      item.timeSeconds && item.timeSeconds > 0
        ? item.timeSeconds
        : Math.max(item.reps * 2, 20);
    const safeSets = Math.max(item.sets || 1, 1);
    const restBetweenSets = Math.max(safeSets - 1, 0) * Math.max(item.restSeconds || 0, 0);
    return acc + perSetWork * safeSets + restBetweenSets;
  }, 0);
  return Math.max(1, Math.round(totalSeconds / 60));
};

export const formatTemplateDuration = (exercises: WorkoutTemplateExercise[]) =>
  `${estimateTemplateDurationMinutes(exercises)} min`;
