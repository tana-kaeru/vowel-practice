import type { FormantEstimate, StabilityResult } from "@/types/vowel";

export function calculateStability(history: FormantEstimate[]): StabilityResult {
  if (history.length < 4) {
    return {
      score: 0.45,
      label: "ふつう",
      variation: 0,
    };
  }

  const recent = history.slice(-24);
  const averageF1 =
    recent.reduce((sum, item) => sum + item.f1Hz, 0) / recent.length;
  const averageF2 =
    recent.reduce((sum, item) => sum + item.f2Hz, 0) / recent.length;
  const variation =
    recent.reduce((sum, item) => {
      const f1 = item.f1Hz - averageF1;
      const f2 = (item.f2Hz - averageF2) / 2;
      return sum + Math.sqrt(f1 * f1 + f2 * f2);
    }, 0) / recent.length;
  const score = Math.max(0, Math.min(1, 1 - variation / 220));

  return {
    score,
    label: score > 0.72 ? "高い" : score < 0.42 ? "低い" : "ふつう",
    variation: Math.round(variation),
  };
}
