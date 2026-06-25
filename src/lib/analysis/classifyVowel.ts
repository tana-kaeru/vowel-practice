import type {
  FormantEstimate,
  VowelClassification,
  VowelSymbol,
} from "@/types/vowel";
import {
  getRangeCenter,
  getVowelTarget,
  VOWEL_TARGETS,
} from "@/lib/data/vowelTargets";

function getDistanceFromTarget(formants: FormantEstimate, target: VowelSymbol) {
  const vowelTarget = getVowelTarget(target);

  if (!vowelTarget) {
    return Number.POSITIVE_INFINITY;
  }

  const f1Center = getRangeCenter(vowelTarget.f1Range);
  const f2Center = getRangeCenter(vowelTarget.f2Range);
  const f1Distance = formants.f1Hz - f1Center;
  const f2Distance = (formants.f2Hz - f2Center) / 2;

  return Math.sqrt(f1Distance * f1Distance + f2Distance * f2Distance);
}

function isInsideRange(formants: FormantEstimate, selectedVowel: VowelSymbol) {
  const target = getVowelTarget(selectedVowel);

  if (!target) {
    return false;
  }

  return (
    formants.f1Hz >= target.f1Range.min &&
    formants.f1Hz <= target.f1Range.max &&
    formants.f2Hz >= target.f2Range.min &&
    formants.f2Hz <= target.f2Range.max
  );
}

export function classifyVowel(
  formants: FormantEstimate,
  selectedVowel: VowelSymbol,
): VowelClassification {
  const nearest = VOWEL_TARGETS.map((target) => {
    return {
      vowel: target.vowel,
      distance: getDistanceFromTarget(formants, target.vowel),
    };
  }).sort((left, right) => left.distance - right.distance)[0];

  const selectedTarget = getVowelTarget(selectedVowel);
  const selectedF1Center = selectedTarget
    ? getRangeCenter(selectedTarget.f1Range)
    : formants.f1Hz;
  const selectedF2Center = selectedTarget
    ? getRangeCenter(selectedTarget.f2Range)
    : formants.f2Hz;
  const distance = nearest?.distance ?? Number.POSITIVE_INFINITY;

  if (!nearest) {
    return {
      selectedVowel,
      nearestVowel: selectedVowel,
      confidence: 0,
      distance: Number.POSITIVE_INFINITY,
      isInsideTargetRange: false,
      f1Diff: 0,
      f2Diff: 0,
    };
  }

  return {
    selectedVowel,
    nearestVowel: nearest.vowel,
    confidence: Math.max(0, Math.min(1, 1 - distance / 900)),
    distance: Math.round(distance),
    isInsideTargetRange: isInsideRange(formants, selectedVowel),
    f1Diff: Math.round(formants.f1Hz - selectedF1Center),
    f2Diff: Math.round(formants.f2Hz - selectedF2Center),
  };
}
