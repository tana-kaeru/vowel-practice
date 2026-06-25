import type {
  FormantEstimate,
  VowelClassification,
  VowelSymbol,
} from "@/types/vowel";
import { VOWEL_TARGETS } from "@/lib/data/vowelTargets";

export function classifyVowel(
  formants: FormantEstimate,
  fallbackVowel: VowelSymbol,
): VowelClassification {
  const nearest = VOWEL_TARGETS.map((target) => {
    const f1Distance = formants.f1Hz - target.f1Hz;
    const f2Distance = (formants.f2Hz - target.f2Hz) / 2;

    return {
      vowel: target.vowel,
      distance: Math.sqrt(f1Distance * f1Distance + f2Distance * f2Distance),
    };
  }).sort((left, right) => left.distance - right.distance)[0];

  if (!nearest) {
    return {
      vowel: fallbackVowel,
      confidence: 0,
      distance: Number.POSITIVE_INFINITY,
    };
  }

  return {
    vowel: nearest.vowel,
    confidence: Math.max(0, Math.min(1, 1 - nearest.distance / 900)),
    distance: Math.round(nearest.distance),
  };
}
