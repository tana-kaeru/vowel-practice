import type { AdviceMessage, AnalysisFrame } from "@/types/vowel";
import {
  BASE_ADVICE,
  LOW_VOLUME_ADVICE,
  STABLE_ADVICE,
  UNSTABLE_ADVICE,
} from "@/lib/data/adviceRules";

export function generateAdvice(frame: AnalysisFrame | null): AdviceMessage[] {
  if (!frame) {
    return [BASE_ADVICE];
  }

  const advice = [BASE_ADVICE];

  if (frame.volume < 0.12) {
    advice.push(LOW_VOLUME_ADVICE);
  }

  if (frame.stability.score >= 0.72 && frame.volume >= 0.12) {
    advice.push(STABLE_ADVICE);
  }

  if (frame.stability.score < 0.42) {
    advice.push(UNSTABLE_ADVICE);
  }

  return advice;
}
