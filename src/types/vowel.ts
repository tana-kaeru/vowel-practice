export type VowelSymbol = "あ" | "い" | "う" | "え" | "お";

export type MicStatus = "idle" | "requesting" | "recording" | "error";

export type MicSensitivity = "low" | "standard" | "high" | "max";

export type PronunciationMode = "standard" | "short";

export type FrequencyBin = {
  frequencyHz: number;
  decibels: number;
  level: number;
};

export type FormantEstimate = {
  f1Hz: number;
  f2Hz: number;
  confidence: number;
};

export type AnalysisStatus =
  | "idle"
  | "calibrating_noise"
  | "listening"
  | "no_voice"
  | "too_quiet"
  | "too_short"
  | "unstable"
  | "low_confidence"
  | "ready";

export type FrequencyRange = {
  min: number;
  max: number;
};

export type MapPosition = {
  x: number;
  y: number;
};

export type VowelTarget = {
  vowel: VowelSymbol;
  label: string;
  roman: string;
  f1Range: FrequencyRange;
  f2Range: FrequencyRange;
  mapPosition: MapPosition;
  colorClass: string;
  color: string;
};

export type VowelClassification = {
  selectedVowel: VowelSymbol;
  nearestVowel: VowelSymbol;
  confidence: number;
  distance: number;
  isInsideTargetRange: boolean;
  f1Diff: number;
  f2Diff: number;
};

export type StabilityResult = {
  score: number;
  label: "低い" | "ふつう" | "高い";
  variation: number;
};

export type AdviceLevel = "info" | "success" | "warning";

export type AdviceMessage = {
  id: string;
  level: AdviceLevel;
  title: string;
  body: string;
};

export type AnalysisFrame = {
  selectedVowel: VowelSymbol;
  status: AnalysisStatus;
  statusMessage: string;
  isReferenceResult?: boolean;
  formants: FormantEstimate | null;
  classification: VowelClassification | null;
  stability: StabilityResult;
  volume: number;
  rawRms: number;
  effectiveRms: number;
  softwareGain: number;
  dbfs: number;
  noiseFloor: number | null;
  currentThreshold: number;
  micSensitivity: MicSensitivity;
  frequencyData: FrequencyBin[];
};

export type VowelTracePoint = {
  f1Hz: number;
  f2Hz: number;
  timestamp: number;
  confidence: number;
  status: AnalysisStatus;
};

export type VowelTrace = {
  id: string;
  targetVowel: VowelSymbol;
  mode: PronunciationMode;
  points: VowelTracePoint[];
  startedAt: number;
  endedAt: number | null;
  result: FormantEstimate | null;
  isCurrent: boolean;
};
