import type {
  FormantEstimate,
  MicSensitivity,
  PronunciationMode,
} from "@/types/vowel";

export const FORMANT_HISTORY_SIZE = 7;
export const MIN_STABILITY_SCORE = 0.48;
export const NOISE_FLOOR_CALIBRATION_MS = 800;
export const DBFS_MIN_RMS = 0.000001;
export const ADVICE_MIN_DISPLAY_MS = 1500;
export const LAST_RESULT_HOLD_MS = 2000;
export const SAME_CANDIDATE_REQUIRED_FRAMES = 4;
export const SWITCH_DISTANCE_MARGIN = 0.15;
export const DISPLAY_FORMANT_SMOOTHING = 0.2;
export const MAX_TRACE_POINTS = 50;
export const MAX_COMPLETED_TRACES = 5;
export const FORMANT_F1_MIN = 120;
export const FORMANT_F1_MAX = 1300;
export const FORMANT_F2_MIN = 400;
export const FORMANT_F2_MAX = 3800;
export const MAX_DISPLAY_F1_STEP_HZ = 160;
export const MAX_DISPLAY_F2_STEP_HZ = 280;
export const RECENT_FORMANT_WINDOW_SIZE = 5;
export const DISPLAY_SMOOTHING_ALPHA = 0.55;
export const TRACE_POINT_INTERVAL_MS = 80;
export const STANDARD_MIN_TRACE_POINTS = 3;
export const SHORT_MIN_TRACE_POINTS = 2;

export const PRONUNCIATION_MODE_CONFIG: Record<
  PronunciationMode,
  {
    label: string;
    minVoiceDurationMs: number;
    initialIgnoreMs: number;
    requiredStableFrames: number;
    minConfidence: number;
  }
> = {
  standard: {
    label: "標準",
    minVoiceDurationMs: 600,
    initialIgnoreMs: 200,
    requiredStableFrames: 4,
    minConfidence: 0.55,
  },
  short: {
    label: "短め",
    minVoiceDurationMs: 250,
    initialIgnoreMs: 80,
    requiredStableFrames: 2,
    minConfidence: 0.45,
  },
};

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
  f1: { min: FORMANT_F1_MIN, max: FORMANT_F1_MAX },
  f2: { min: FORMANT_F2_MIN, max: FORMANT_F2_MAX },
};

export type FormantRejectionReason =
  | "out_of_range"
  | null;

export type FormantClampReason = "f1_step" | "f2_step" | "f1_f2_step" | null;

export type FormantFilterPoint = FormantEstimate & {
  timestamp: number;
};

export type FormantFilterState = {
  previousFilteredPoint: FormantFilterPoint | null;
  previousDisplayPoint: FormantFilterPoint | null;
  recentAcceptedPoints: FormantFilterPoint[];
  rejectedFrameCount: number;
};

export type FormantFilterInput = FormantEstimate & {
  timestamp: number;
};

export type FormantFilterResult = {
  rawF1Hz: number;
  rawF2Hz: number;
  filteredF1Hz: number | null;
  filteredF2Hz: number | null;
  displayF1Hz: number | null;
  displayF2Hz: number | null;
  accepted: boolean;
  rejectedReason: FormantRejectionReason;
  confidence: number;
  recentAcceptedPointCount: number;
  rejectedFrameCount: number;
  jumpDistance: number | null;
  displayStepF1Hz: number | null;
  displayStepF2Hz: number | null;
  wasClamped: boolean;
  clampReason: FormantClampReason;
};

export function createInitialFormantFilterState(): FormantFilterState {
  return {
    previousFilteredPoint: null,
    previousDisplayPoint: null,
    recentAcceptedPoints: [],
    rejectedFrameCount: 0,
  };
}

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

function getFormantJumpDistance(
  current: FormantEstimate,
  previous: FormantEstimate,
) {
  const f1Distance = current.f1Hz - previous.f1Hz;
  const f2Distance = (current.f2Hz - previous.f2Hz) / 2;

  return Math.round(Math.sqrt(f1Distance * f1Distance + f2Distance * f2Distance));
}

function getMedianFormantPoint(points: FormantFilterPoint[], timestamp: number) {
  return {
    f1Hz: Math.round(median(points.map((point) => point.f1Hz))),
    f2Hz: Math.round(median(points.map((point) => point.f2Hz))),
    confidence:
      Math.round(median(points.map((point) => point.confidence)) * 100) / 100,
    timestamp,
  };
}

function getDisplayPoint(
  filteredPoint: FormantFilterPoint,
  previousDisplayPoint: FormantFilterPoint | null,
): {
  displayPoint: FormantFilterPoint;
  displayStepF1Hz: number | null;
  displayStepF2Hz: number | null;
  wasClamped: boolean;
  clampReason: FormantClampReason;
} {
  if (!previousDisplayPoint) {
    return {
      displayPoint: filteredPoint,
      displayStepF1Hz: null,
      displayStepF2Hz: null,
      wasClamped: false,
      clampReason: null,
    };
  }

  const f1Delta = filteredPoint.f1Hz - previousDisplayPoint.f1Hz;
  const f2Delta = filteredPoint.f2Hz - previousDisplayPoint.f2Hz;
  const clampedF1Delta = Math.max(
    -MAX_DISPLAY_F1_STEP_HZ,
    Math.min(MAX_DISPLAY_F1_STEP_HZ, f1Delta),
  );
  const clampedF2Delta = Math.max(
    -MAX_DISPLAY_F2_STEP_HZ,
    Math.min(MAX_DISPLAY_F2_STEP_HZ, f2Delta),
  );
  const isF1Clamped = clampedF1Delta !== f1Delta;
  const isF2Clamped = clampedF2Delta !== f2Delta;
  const clampedCandidate = {
    ...filteredPoint,
    f1Hz: previousDisplayPoint.f1Hz + clampedF1Delta,
    f2Hz: previousDisplayPoint.f2Hz + clampedF2Delta,
  };
  const displayPoint = {
    f1Hz: Math.round(
      previousDisplayPoint.f1Hz * (1 - DISPLAY_SMOOTHING_ALPHA) +
        clampedCandidate.f1Hz * DISPLAY_SMOOTHING_ALPHA,
    ),
    f2Hz: Math.round(
      previousDisplayPoint.f2Hz * (1 - DISPLAY_SMOOTHING_ALPHA) +
        clampedCandidate.f2Hz * DISPLAY_SMOOTHING_ALPHA,
    ),
    confidence: filteredPoint.confidence,
    timestamp: filteredPoint.timestamp,
  };

  return {
    displayPoint,
    displayStepF1Hz: displayPoint.f1Hz - previousDisplayPoint.f1Hz,
    displayStepF2Hz: displayPoint.f2Hz - previousDisplayPoint.f2Hz,
    wasClamped: isF1Clamped || isF2Clamped,
    clampReason:
      isF1Clamped && isF2Clamped
        ? "f1_f2_step"
        : isF1Clamped
          ? "f1_step"
          : isF2Clamped
            ? "f2_step"
            : null,
  };
}

export function isFormantInUsableRange(formants: FormantEstimate) {
  return (
    formants.f1Hz >= VALID_FORMANT_RANGE.f1.min &&
    formants.f1Hz <= VALID_FORMANT_RANGE.f1.max &&
    formants.f2Hz >= VALID_FORMANT_RANGE.f2.min &&
    formants.f2Hz <= VALID_FORMANT_RANGE.f2.max
  );
}

export function stabilizeFormantEstimate(
  input: FormantFilterInput,
  state: FormantFilterState,
): {
  result: FormantFilterResult;
  nextState: FormantFilterState;
} {
  const rawPoint: FormantFilterPoint = {
    f1Hz: input.f1Hz,
    f2Hz: input.f2Hz,
    confidence: input.confidence,
    timestamp: input.timestamp,
  };
  const isInRange = isFormantInUsableRange(rawPoint);
  const previous = state.previousFilteredPoint;
  const jumpDistance = previous ? getFormantJumpDistance(rawPoint, previous) : null;

  let rejectedReason: FormantRejectionReason = null;

  if (!isInRange) {
    rejectedReason = "out_of_range";
  }

  if (rejectedReason) {
    const rejectedFrameCount = state.rejectedFrameCount + 1;

    return {
      result: {
        rawF1Hz: rawPoint.f1Hz,
        rawF2Hz: rawPoint.f2Hz,
        filteredF1Hz: previous?.f1Hz ?? null,
        filteredF2Hz: previous?.f2Hz ?? null,
        displayF1Hz: state.previousDisplayPoint?.f1Hz ?? null,
        displayF2Hz: state.previousDisplayPoint?.f2Hz ?? null,
        accepted: false,
        rejectedReason,
        confidence: rawPoint.confidence,
        recentAcceptedPointCount: state.recentAcceptedPoints.length,
        rejectedFrameCount,
        jumpDistance,
        displayStepF1Hz: null,
        displayStepF2Hz: null,
        wasClamped: false,
        clampReason: null,
      },
      nextState: {
        ...state,
        rejectedFrameCount,
      },
    };
  }

  const recentAcceptedPoints = [...state.recentAcceptedPoints, rawPoint].slice(
    -RECENT_FORMANT_WINDOW_SIZE,
  );
  const filteredPoint = getMedianFormantPoint(
    recentAcceptedPoints,
    rawPoint.timestamp,
  );
  const {
    displayPoint,
    displayStepF1Hz,
    displayStepF2Hz,
    wasClamped,
    clampReason,
  } = getDisplayPoint(filteredPoint, state.previousDisplayPoint);
  const nextState: FormantFilterState = {
    previousFilteredPoint: filteredPoint,
    previousDisplayPoint: displayPoint,
    recentAcceptedPoints,
    rejectedFrameCount: 0,
  };

  return {
    result: {
      rawF1Hz: rawPoint.f1Hz,
      rawF2Hz: rawPoint.f2Hz,
      filteredF1Hz: filteredPoint.f1Hz,
      filteredF2Hz: filteredPoint.f2Hz,
      displayF1Hz: displayPoint.f1Hz,
      displayF2Hz: displayPoint.f2Hz,
      accepted: true,
      rejectedReason: null,
      confidence: filteredPoint.confidence,
      recentAcceptedPointCount: recentAcceptedPoints.length,
      rejectedFrameCount: 0,
      jumpDistance,
      displayStepF1Hz,
      displayStepF2Hz,
      wasClamped,
      clampReason,
    },
    nextState,
  };
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
