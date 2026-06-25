export type VowelSymbol = "あ" | "い" | "う" | "え" | "お";

export type MicStatus = "idle" | "requesting" | "recording" | "error";

export type FrequencyBin = {
  frequencyHz: number;
  level: number;
};

export type FormantEstimate = {
  f1Hz: number;
  f2Hz: number;
  confidence: number;
};

export type VowelTarget = {
  vowel: VowelSymbol;
  label: string;
  f1Hz: number;
  f2Hz: number;
  colorClass: string;
};

export type VowelClassification = {
  vowel: VowelSymbol;
  confidence: number;
  distance: number;
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
  formants: FormantEstimate;
  classification: VowelClassification;
  stability: StabilityResult;
  volume: number;
  frequencyData: FrequencyBin[];
};
