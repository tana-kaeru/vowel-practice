import type { FormantEstimate, MicSensitivity } from "@/types/vowel";

export const FORMANT_HISTORY_SIZE = 7;
export const MIN_ANALYSIS_DELAY_MS = 200;
export const MIN_STABLE_VOICE_MS = 350;
export const MIN_CONFIDENCE = 0.45;
export const MIN_STABILITY_SCORE = 0.48;
export const NOISE_FLOOR_CALIBRATION_MS = 800;
export const DBFS_MIN_RMS = 0.000001;

export const VOLUME_THRESHOLDS = {
  tooQuiet: 0.012,
  good: 0.025,
  tooLoud: 0.8,
  minFormantAnalysisVolume: 0.03,
  rawVoiceMargin: 0.0015,
  highNoiseFloor: 0.012,
};

export const MIC_SENSITIVITY_CONFIG: Record<
  MicSensitivity,
  {
    label: string;
    softwareGain: number;
  }
> = {
  low: {
    label: "低",
    softwareGain: 1,
  },
  standard: {
    label: "標準",
    softwareGain: 3,
  },
  high: {
    label: "高",
    softwareGain: 8,
  },
  max: {
    label: "最大",
    softwareGain: 16,
  },
};

const VALID_FORMANT_RANGE = {
  f1: { min: 180, max: 1100 },
  f2: { min: 650, max: 3300 },
};

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function isFormantInUsableRange(formants: FormantEstimate) {
  return (
    formants.f1Hz >= VALID_FORMANT_RANGE.f1.min &&
    formants.f1Hz <= VALID_FORMANT_RANGE.f1.max &&
    formants.f2Hz >= VALID_FORMANT_RANGE.f2.min &&
    formants.f2Hz <= VALID_FORMANT_RANGE.f2.max &&
    formants.f2Hz > formants.f1Hz + 250
  );
}

export function calculateDbfs(rms: number) {
  return 20 * Math.log10(Math.max(rms, DBFS_MIN_RMS));
}

export function getSoftwareGain(sensitivity: MicSensitivity) {
  return MIC_SENSITIVITY_CONFIG[sensitivity].softwareGain;
}

export function getEffectiveRms(rawRms: number, sensitivity: MicSensitivity) {
  return Math.min(1, rawRms * getSoftwareGain(sensitivity));
}

export function getVoiceThreshold() {
  return VOLUME_THRESHOLDS.tooQuiet;
}

export function hasVoiceLikeInput(rawRms: number, noiseFloor: number | null) {
  if (noiseFloor === null) {
    return rawRms >= VOLUME_THRESHOLDS.rawVoiceMargin;
  }

  return rawRms >= noiseFloor + VOLUME_THRESHOLDS.rawVoiceMargin;
}

export function getAnalysisVolume(effectiveRms: number) {
  return Math.min(1, effectiveRms * 4);
}

export function getDisplayVolume(effectiveRms: number) {
  return Math.min(1, effectiveRms * 4);
}

export function getMedianFormants(
  history: FormantEstimate[],
): FormantEstimate | null {
  const recent = history.slice(-FORMANT_HISTORY_SIZE);

  if (recent.length < 3) {
    return null;
  }

  return {
    f1Hz: Math.round(median(recent.map((item) => item.f1Hz))),
    f2Hz: Math.round(median(recent.map((item) => item.f2Hz))),
    confidence:
      Math.round(median(recent.map((item) => item.confidence)) * 100) / 100,
  };
}
