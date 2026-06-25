import type { FormantEstimate, FrequencyBin, VowelSymbol } from "@/types/vowel";
import { VOWEL_TARGETS } from "@/lib/data/vowelTargets";

export function estimateFormants(
  frequencyData: FrequencyBin[],
  selectedVowel: VowelSymbol,
  volume: number,
): FormantEstimate {
  const target = VOWEL_TARGETS.find((item) => item.vowel === selectedVowel);
  const strongestBin = frequencyData.reduce<FrequencyBin | undefined>(
    (current, bin) => (!current || bin.level > current.level ? bin : current),
    undefined,
  );

  if (!target || !strongestBin || volume < 0.03) {
    return {
      f1Hz: target?.f1Hz ?? 500,
      f2Hz: target?.f2Hz ?? 1500,
      confidence: 0.1,
    };
  }

  const drift = Math.max(-120, Math.min(120, strongestBin.frequencyHz / 18 - 80));

  return {
    f1Hz: Math.round(target.f1Hz + drift),
    f2Hz: Math.round(target.f2Hz - drift * 1.8),
    confidence: Math.min(0.85, 0.25 + volume),
  };
}
