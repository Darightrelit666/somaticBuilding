import { describe, expect, it } from "vitest";
import {
  isConcreteExerciseLabelCandidate,
  isGenericExercisePlaceholderName,
  isNarrativeExerciseLabel
} from "./exerciseLabelSafety";

describe("exercise label safety", () => {
  it("accepts concrete Chinese and English exercise labels", () => {
    expect(isConcreteExerciseLabelCandidate("杠铃卧推")).toBe(true);
    expect(isConcreteExerciseLabelCandidate("引体向上")).toBe(true);
    expect(isConcreteExerciseLabelCandidate("Dumbbell Shoulder Press")).toBe(true);
    expect(isConcreteExerciseLabelCandidate("Box Jump")).toBe(true);
  });

  it("rejects plan narrative sentences as exercise labels", () => {
    expect(
      isConcreteExerciseLabelCandidate("为了发展扣篮所需的下肢爆发力，我们将采用Athletic风格")
    ).toBe(false);
    expect(
      isConcreteExerciseLabelCandidate(
        "Designed to improve upper-body strength through progressive loading"
      )
    ).toBe(false);
    expect(isNarrativeExerciseLabel("目标：提升卧推和引体向上表现")).toBe(true);
  });

  it("rejects generic placeholders", () => {
    expect(isGenericExercisePlaceholderName("Exercise #12")).toBe(true);
    expect(isGenericExercisePlaceholderName("动作3")).toBe(true);
    expect(isConcreteExerciseLabelCandidate("Exercise #12")).toBe(false);
  });
});
