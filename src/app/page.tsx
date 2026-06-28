"use client";

import { useCallback, useRef, useState } from "react";
import AdSlot from "@/components/AdSlot";
import AdvicePanel from "@/components/AdvicePanel";
import MicControl from "@/components/MicControl";
import ResultPanel from "@/components/ResultPanel";
import SpectrumGraph from "@/components/SpectrumGraph";
import VowelMap from "@/components/VowelMap";
import VowelSelector from "@/components/VowelSelector";
import type { AudioAnalyserSession } from "@/lib/audio/createAudioAnalyser";
import { calculateStability } from "@/lib/analysis/calculateStability";
import { classifyVowel } from "@/lib/analysis/classifyVowel";
import { estimateFormants } from "@/lib/analysis/estimateFormants";
import { generateAdvice } from "@/lib/analysis/generateAdvice";
import { APP_STAGE, APP_TITLE, APP_VERSION } from "@/lib/data/appMeta";
import {
  ADVICE_MIN_DISPLAY_MS,
  calculateDbfs,
  createInitialFormantFilterState,
  getAnalysisVolume,
  getDisplayVolume,
  getEffectiveRms,
  getMedianFormants,
  getSoftwareGain,
  getVoiceThreshold,
  hasVoiceLikeInput,
  isFormantInUsableRange,
  LAST_RESULT_HOLD_MS,
  MIN_STABILITY_SCORE,
  MAX_COMPLETED_TRACES,
  MAX_TRACE_POINTS,
  NOISE_FLOOR_CALIBRATION_MS,
  PRONUNCIATION_MODE_CONFIG,
  SAME_CANDIDATE_REQUIRED_FRAMES,
  SHORT_MIN_TRACE_POINTS,
  STANDARD_MIN_TRACE_POINTS,
  SWITCH_DISTANCE_MARGIN,
  stabilizeFormantEstimate,
  TRACE_POINT_INTERVAL_MS,
} from "@/lib/analysis/stabilizeFormants";
import type { FormantFilterResult } from "@/lib/analysis/stabilizeFormants";
import type {
  AdviceMessage,
  AnalysisFrame,
  FormantEstimate,
  FrequencyBin,
  MicSensitivity,
  MicStatus,
  PronunciationMode,
  VowelTrace,
  VowelTracePoint,
  VowelSymbol,
} from "@/types/vowel";

type AudioDebugState = {
  lastRms: number | null;
  lastFrequencyDataUpdatedAt: number | null;
  animationLoopRunning: boolean;
};

const EMPTY_FORMANT_DEBUG: NonNullable<AnalysisFrame["formantDebug"]> = {
  rawF1Hz: null,
  rawF2Hz: null,
  filteredF1Hz: null,
  filteredF2Hz: null,
  displayF1Hz: null,
  displayF2Hz: null,
  accepted: false,
  rejectedReason: null,
  recentAcceptedPointCount: 0,
  rejectedFrameCount: 0,
  jumpDistance: null,
  confidence: null,
  displayStepF1Hz: null,
  displayStepF2Hz: null,
  wasClamped: false,
  clampReason: null,
  tracePointAdded: false,
  tracePointSkippedReason: null,
  currentTracePointCount: 0,
  completedTraceCount: 0,
  lastTraceSaveReason: null,
  lastTraceSkipReason: null,
};

function getFormantDebug(result: FormantFilterResult) {
  return {
    rawF1Hz: result.rawF1Hz,
    rawF2Hz: result.rawF2Hz,
    filteredF1Hz: result.filteredF1Hz,
    filteredF2Hz: result.filteredF2Hz,
    displayF1Hz: result.displayF1Hz,
    displayF2Hz: result.displayF2Hz,
    accepted: result.accepted,
    rejectedReason: result.rejectedReason,
    recentAcceptedPointCount: result.recentAcceptedPointCount,
    rejectedFrameCount: result.rejectedFrameCount,
    jumpDistance: result.jumpDistance,
    confidence: result.confidence,
    displayStepF1Hz: result.displayStepF1Hz,
    displayStepF2Hz: result.displayStepF2Hz,
    wasClamped: result.wasClamped,
    clampReason: result.clampReason,
    tracePointAdded: false,
    tracePointSkippedReason: null,
    currentTracePointCount: 0,
    completedTraceCount: 0,
    lastTraceSaveReason: null,
    lastTraceSkipReason: null,
  };
}

function getMedianNumber(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length === 0) {
    return 0;
  }

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function getTraceRepresentative(points: VowelTracePoint[]) {
  if (points.length === 0) {
    return null;
  }

  return {
    f1Hz: Math.round(getMedianNumber(points.map((point) => point.f1Hz))),
    f2Hz: Math.round(getMedianNumber(points.map((point) => point.f2Hz))),
    confidence:
      Math.round(getMedianNumber(points.map((point) => point.confidence)) * 100) /
      100,
  };
}

export default function Home() {
  const [selectedVowel, setSelectedVowel] = useState<VowelSymbol>("あ");
  const [micStatus, setMicStatus] = useState<MicStatus>("idle");
  const [micSensitivity, setMicSensitivity] =
    useState<MicSensitivity>("standard");
  const [pronunciationMode, setPronunciationMode] =
    useState<PronunciationMode>("standard");
  const [audioSession, setAudioSession] =
    useState<AudioAnalyserSession | null>(null);
  const [rawAnalysisResult, setRawAnalysisResult] =
    useState<AnalysisFrame | null>(null);
  const [displayAnalysisResult, setDisplayAnalysisResult] =
    useState<AnalysisFrame | null>(null);
  const [adviceMessages, setAdviceMessages] = useState<AdviceMessage[]>(() =>
    generateAdvice(null).slice(0, 2),
  );
  const [formantTrail, setFormantTrail] = useState<FormantEstimate[]>([]);
  const [currentTrace, setCurrentTrace] = useState<VowelTrace | null>(null);
  const [completedTraces, setCompletedTraces] = useState<VowelTrace[]>([]);
  const [showTraceHistory, setShowTraceHistory] = useState(true);
  const [audioDebug, setAudioDebug] = useState<AudioDebugState>({
    lastRms: null,
    lastFrequencyDataUpdatedAt: null,
    animationLoopRunning: false,
  });
  const formantHistoryRef = useRef<FormantEstimate[]>([]);
  const stabilizedFormantHistoryRef = useRef<FormantEstimate[]>([]);
  const currentTraceRef = useRef<VowelTrace | null>(null);
  const displayAnalysisResultRef = useRef<AnalysisFrame | null>(null);
  const displayFormantsRef = useRef<FormantEstimate | null>(null);
  const formantFilterStateRef = useRef(createInitialFormantFilterState());
  const candidateRef = useRef<{
    vowel: VowelSymbol;
    count: number;
    distance: number;
  } | null>(null);
  const lastDisplayUpdateAtRef = useRef(0);
  const lastAdviceUpdateAtRef = useRef(0);
  const adviceKeyRef = useRef("");
  const utteranceStartAtRef = useRef<number | null>(null);
  const noiseCalibrationStartAtRef = useRef<number | null>(null);
  const noiseSamplesRef = useRef<number[]>([]);
  const noiseFloorRef = useRef<number | null>(null);
  const lastAnalysisAtRef = useRef(0);
  const lastTracePointAtRef = useRef(0);
  const lastTraceSaveReasonRef = useRef<string | null>(null);
  const lastTraceSkipReasonRef = useRef<string | null>(null);
  const traceIdRef = useRef(0);

  const resetAnalysis = useCallback(() => {
    setRawAnalysisResult(null);
    setDisplayAnalysisResult(null);
    setAdviceMessages(generateAdvice(null).slice(0, 2));
    setFormantTrail([]);
    setCurrentTrace(null);
    formantHistoryRef.current = [];
    stabilizedFormantHistoryRef.current = [];
    currentTraceRef.current = null;
    displayAnalysisResultRef.current = null;
    displayFormantsRef.current = null;
    formantFilterStateRef.current = createInitialFormantFilterState();
    candidateRef.current = null;
    lastDisplayUpdateAtRef.current = 0;
    lastAdviceUpdateAtRef.current = 0;
    lastTracePointAtRef.current = 0;
    lastTraceSaveReasonRef.current = null;
    lastTraceSkipReasonRef.current = null;
    adviceKeyRef.current = "";
    utteranceStartAtRef.current = null;
  }, []);

  const resetNoiseCalibration = useCallback(() => {
    noiseCalibrationStartAtRef.current = null;
    noiseSamplesRef.current = [];
    noiseFloorRef.current = null;
  }, []);

  const handleSelectVowel = useCallback((vowel: VowelSymbol) => {
    setSelectedVowel(vowel);
    setCompletedTraces([]);
    resetAnalysis();
  }, [resetAnalysis]);

  const handleSensitivityChange = useCallback(
    (sensitivity: MicSensitivity) => {
      setMicSensitivity(sensitivity);
      resetAnalysis();
    },
    [resetAnalysis],
  );

  const handlePronunciationModeChange = useCallback(
    (mode: PronunciationMode) => {
      setPronunciationMode(mode);
      resetAnalysis();
    },
    [resetAnalysis],
  );

  const handleClearTraceHistory = useCallback(() => {
    setCompletedTraces([]);
  }, []);

  const handleSessionChange = useCallback(
    (session: AudioAnalyserSession | null) => {
      setAudioSession(session);
      setAudioDebug((previous) => ({
        ...previous,
        animationLoopRunning: session !== null,
      }));
      resetAnalysis();
      resetNoiseCalibration();
    },
    [resetAnalysis, resetNoiseCalibration],
  );

  const updateAdviceMessages = useCallback(
    (
      sourceFrame: AnalysisFrame | null,
      now: number,
      force = false,
    ) => {
      const nextMessages = generateAdvice(sourceFrame).slice(0, 2);
      const nextKey = nextMessages.map((message) => message.id).join("|");

      if (
        !force &&
        nextKey !== adviceKeyRef.current &&
        now - lastAdviceUpdateAtRef.current < ADVICE_MIN_DISPLAY_MS
      ) {
        return;
      }

      if (nextKey !== adviceKeyRef.current) {
        setAdviceMessages(nextMessages);
        adviceKeyRef.current = nextKey;
        lastAdviceUpdateAtRef.current = now;
      }
    },
    [],
  );

  const appendTracePoint = useCallback(
    (formants: FormantEstimate, status: AnalysisFrame["status"], now: number) => {
      const point: VowelTracePoint = {
        f1Hz: formants.f1Hz,
        f2Hz: formants.f2Hz,
        timestamp: now,
        confidence: formants.confidence,
        status,
      };
      const existingTrace = currentTraceRef.current;
      const trace =
        existingTrace ??
        ({
          id: `trace-${traceIdRef.current + 1}`,
          targetVowel: selectedVowel,
          mode: pronunciationMode,
          points: [],
          startedAt: now,
          endedAt: null,
          result: null,
          isCurrent: true,
        } satisfies VowelTrace);

      if (!existingTrace) {
        traceIdRef.current += 1;
      }

      const nextTrace = {
        ...trace,
        points: [...trace.points, point].slice(-MAX_TRACE_POINTS),
      };

      currentTraceRef.current = nextTrace;
      setCurrentTrace(nextTrace);
      return nextTrace;
    },
    [pronunciationMode, selectedVowel],
  );

  const updateDisplayAnalysisResult = useCallback(
    (nextFrame: AnalysisFrame, now: number) => {
      setRawAnalysisResult(nextFrame);

      const forceAdviceStatus =
        nextFrame.status === "calibrating_noise" ||
        nextFrame.status === "no_voice" ||
        nextFrame.status === "too_quiet";

      if (
        nextFrame.status !== "ready" ||
        !nextFrame.classification ||
        !nextFrame.formants
      ) {
        if (
          displayAnalysisResultRef.current &&
          forceAdviceStatus &&
          now - lastDisplayUpdateAtRef.current <= LAST_RESULT_HOLD_MS
        ) {
          updateAdviceMessages(displayAnalysisResultRef.current, now);
          return;
        }

        if (
          displayAnalysisResultRef.current &&
          forceAdviceStatus &&
          now - lastDisplayUpdateAtRef.current > LAST_RESULT_HOLD_MS
        ) {
          displayAnalysisResultRef.current = null;
          displayFormantsRef.current = null;
          setDisplayAnalysisResult(null);
        }

        const shortModeListeningFrame: AnalysisFrame = {
          ...nextFrame,
          status: "listening",
          statusMessage: "発声が終わったら参考判定します。",
          formants: null,
          classification: null,
        };

        updateAdviceMessages(
          forceAdviceStatus
            ? nextFrame
            : displayAnalysisResultRef.current ??
                (pronunciationMode === "short"
                  ? shortModeListeningFrame
                  : nextFrame),
          now,
          forceAdviceStatus,
        );
        return;
      }

      if (
        pronunciationMode === "short" &&
        nextFrame.isReferenceResult !== true
      ) {
        updateAdviceMessages(
          displayAnalysisResultRef.current ?? {
            ...nextFrame,
            status: "listening",
            statusMessage: "短めの発声を聞き取っています。",
            formants: null,
            classification: null,
          },
          now,
        );
        return;
      }

      const nearestVowel = nextFrame.classification.nearestVowel;
      const previousCandidate = candidateRef.current;
      const count =
        previousCandidate?.vowel === nearestVowel
          ? previousCandidate.count + 1
          : 1;

      candidateRef.current = {
        vowel: nearestVowel,
        count,
        distance: nextFrame.classification.distance,
      };

      const currentDisplay = displayAnalysisResultRef.current;
      const currentClassification = currentDisplay?.classification ?? null;
      const isSameDisplayedVowel =
        currentClassification?.nearestVowel === nearestVowel;
      const hasStableCandidate = count >= SAME_CANDIDATE_REQUIRED_FRAMES;
      const requiredFrames =
        PRONUNCIATION_MODE_CONFIG[pronunciationMode].requiredStableFrames;
      const hasModeStableCandidate = count >= requiredFrames;
      const isClearlyCloser =
        currentClassification !== null &&
        nextFrame.classification.distance <
          currentClassification.distance * (1 - SWITCH_DISTANCE_MARGIN);
      const needsInitialDisplay = currentDisplay === null;
      const forceReferenceDisplay = nextFrame.isReferenceResult === true;

      if (
        !forceReferenceDisplay &&
        ((needsInitialDisplay && !hasModeStableCandidate) ||
        !needsInitialDisplay &&
        !isSameDisplayedVowel &&
        !hasStableCandidate &&
        !hasModeStableCandidate &&
        !isClearlyCloser)
      ) {
        updateAdviceMessages(
          currentDisplay ?? {
            ...nextFrame,
            status: "listening",
            statusMessage: "安定したら判定します。",
            formants: null,
            classification: null,
          },
          now,
        );
        return;
      }

      const displayFormants =
        !forceReferenceDisplay &&
        nextFrame.formantDebug &&
        nextFrame.formantDebug?.displayF1Hz !== null &&
        nextFrame.formantDebug?.displayF2Hz !== null
          ? {
              f1Hz: nextFrame.formantDebug.displayF1Hz,
              f2Hz: nextFrame.formantDebug.displayF2Hz,
              confidence: nextFrame.formants.confidence,
            }
          : nextFrame.formants;
      const displayClassification = classifyVowel(
        displayFormants,
        selectedVowel,
      );
      const nextDisplayFrame: AnalysisFrame = {
        ...nextFrame,
        statusMessage: forceReferenceDisplay
          ? nextFrame.statusMessage
          : "安定した判定を表示しています。",
        formants: displayFormants,
        classification: displayClassification,
      };

      displayAnalysisResultRef.current = nextDisplayFrame;
      displayFormantsRef.current = displayFormants;
      lastDisplayUpdateAtRef.current = now;
      stabilizedFormantHistoryRef.current = [
        ...stabilizedFormantHistoryRef.current,
        displayFormants,
      ].slice(-18);

      setDisplayAnalysisResult(nextDisplayFrame);
      setFormantTrail(stabilizedFormantHistoryRef.current);
      updateAdviceMessages(nextDisplayFrame, now, forceReferenceDisplay);
    },
    [
      pronunciationMode,
      selectedVowel,
      updateAdviceMessages,
    ],
  );

  const finishCurrentTrace = useCallback(
    (endFrame: AnalysisFrame, now: number) => {
      const trace = currentTraceRef.current;

      if (!trace) {
        return false;
      }

      const minTracePoints =
        trace.mode === "short" ? SHORT_MIN_TRACE_POINTS : STANDARD_MIN_TRACE_POINTS;
      const candidatePoints = trace.points;
      const representative = getTraceRepresentative(candidatePoints);

      currentTraceRef.current = null;
      setCurrentTrace(null);

      if (candidatePoints.length < minTracePoints || !representative) {
        lastTraceSkipReasonRef.current = `trace_points_${candidatePoints.length}_below_${minTracePoints}`;
        return false;
      }

      const completedTrace: VowelTrace = {
        ...trace,
        endedAt: now,
        result: representative,
        isCurrent: false,
      };

      setCompletedTraces((previous) =>
        [...previous, completedTrace].slice(-MAX_COMPLETED_TRACES),
      );
      lastTraceSaveReasonRef.current = `${trace.mode}_trace_saved_${candidatePoints.length}_points`;
      lastTraceSkipReasonRef.current = null;

      if (
        trace.mode !== "short" ||
        candidatePoints.length < SHORT_MIN_TRACE_POINTS
      ) {
        return false;
      }

      const classification = classifyVowel(representative, trace.targetVowel);
      const referenceFrame: AnalysisFrame = {
        ...endFrame,
        selectedVowel: trace.targetVowel,
        status: "ready",
        statusMessage: "短めの発声から参考判定しています。",
        isReferenceResult: true,
        formants: representative,
        classification,
        stability: calculateStability(
          candidatePoints.map((point) => ({
            f1Hz: point.f1Hz,
            f2Hz: point.f2Hz,
            confidence: point.confidence,
          })),
        ),
      };

      updateDisplayAnalysisResult(referenceFrame, now);
      return true;
    },
    [updateDisplayAnalysisResult],
  );

  const handleMicFrame = useCallback(
    ({
      frequencyData,
      rms,
    }: {
      frequencyData: FrequencyBin[];
      rms: number;
    }) => {
      const now = performance.now();

      if (now - lastAnalysisAtRef.current < TRACE_POINT_INTERVAL_MS) {
        return;
      }

      lastAnalysisAtRef.current = now;
      setAudioDebug({
        lastRms: rms,
        lastFrequencyDataUpdatedAt: Date.now(),
        animationLoopRunning: true,
      });
      const rawRms = rms;
      const effectiveRms = getEffectiveRms(rawRms, micSensitivity);
      const softwareGain = getSoftwareGain(micSensitivity);
      const effectiveVolume = getDisplayVolume(effectiveRms);
      const dbfs = calculateDbfs(rawRms);
      const noiseFloor = noiseFloorRef.current;
      const currentThreshold = getVoiceThreshold();

      if (noiseFloor === null) {
        if (noiseCalibrationStartAtRef.current === null) {
          noiseCalibrationStartAtRef.current = now;
          noiseSamplesRef.current = [];
        }

        noiseSamplesRef.current = [...noiseSamplesRef.current, rawRms].slice(
          -20,
        );

        if (
          now - noiseCalibrationStartAtRef.current <
          NOISE_FLOOR_CALIBRATION_MS
        ) {
          updateDisplayAnalysisResult({
            selectedVowel,
            status: "calibrating_noise",
            statusMessage: "環境音を測定中です。",
            formants: null,
            classification: null,
            stability: calculateStability([]),
            volume: effectiveVolume,
            rawRms,
            effectiveRms,
            softwareGain,
            dbfs,
            noiseFloor: null,
            currentThreshold,
            micSensitivity,
            frequencyData,
          }, now);
          return;
        }

        const samples = noiseSamplesRef.current;
        noiseFloorRef.current =
          samples.length === 0
            ? 0
            : samples.reduce((sum, item) => sum + item, 0) / samples.length;
      }

      const currentNoiseFloor = noiseFloorRef.current;
      const hasEnoughEffectiveVolume = effectiveRms >= currentThreshold;
      const voiceDetected =
        hasEnoughEffectiveVolume || hasVoiceLikeInput(rawRms, currentNoiseFloor);

      if (!voiceDetected) {
        utteranceStartAtRef.current = null;
        formantHistoryRef.current = [];
        stabilizedFormantHistoryRef.current = [];
        formantFilterStateRef.current = createInitialFormantFilterState();
        const noVoiceFrame: AnalysisFrame = {
          selectedVowel,
          status: "no_voice",
          statusMessage: "発声入力を待っています。",
          formants: null,
          classification: null,
          stability: calculateStability([]),
          volume: effectiveVolume,
          rawRms,
          effectiveRms,
          softwareGain,
          dbfs,
          noiseFloor: currentNoiseFloor,
          currentThreshold,
          micSensitivity,
          frequencyData,
        };
        const usedReferenceResult = finishCurrentTrace(noVoiceFrame, now);

        if (usedReferenceResult) {
          setRawAnalysisResult(noVoiceFrame);
        } else {
          updateDisplayAnalysisResult(noVoiceFrame, now);
        }
        return;
      }

      if (!hasEnoughEffectiveVolume) {
        utteranceStartAtRef.current = null;
        formantHistoryRef.current = [];
        stabilizedFormantHistoryRef.current = [];
        formantFilterStateRef.current = createInitialFormantFilterState();
        updateDisplayAnalysisResult({
          selectedVowel,
          status: "too_quiet",
          statusMessage:
            "マイクに入る音量が少し控えめです。",
          formants: null,
          classification: null,
          stability: calculateStability([]),
          volume: effectiveVolume,
          rawRms,
          effectiveRms,
          softwareGain,
          dbfs,
          noiseFloor: currentNoiseFloor,
          currentThreshold,
          micSensitivity,
          frequencyData,
        }, now);
        return;
      }

      if (utteranceStartAtRef.current === null) {
        utteranceStartAtRef.current = now;
        formantHistoryRef.current = [];
        stabilizedFormantHistoryRef.current = [];
        formantFilterStateRef.current = createInitialFormantFilterState();
        currentTraceRef.current = null;
        setCurrentTrace(null);
      }

      const voicedDurationMs = now - utteranceStartAtRef.current;
      const modeConfig = PRONUNCIATION_MODE_CONFIG[pronunciationMode];
      const analysisVolume = getAnalysisVolume(effectiveRms);
      const rawFormants = estimateFormants(frequencyData, analysisVolume);
      let formantDebug = rawFormants
        ? EMPTY_FORMANT_DEBUG
        : displayAnalysisResultRef.current?.formantDebug ?? EMPTY_FORMANT_DEBUG;
      let acceptedFormants: FormantEstimate | null = null;
      let displayTraceFormants: FormantEstimate | null = null;

      if (rawFormants) {
        const { result, nextState } = stabilizeFormantEstimate(
          {
            ...rawFormants,
            timestamp: now,
          },
          formantFilterStateRef.current,
        );

        formantFilterStateRef.current = nextState;
        formantDebug = getFormantDebug(result);
        formantDebug.completedTraceCount = completedTraces.length;
        formantDebug.currentTracePointCount =
          currentTraceRef.current?.points.length ?? 0;
        formantDebug.lastTraceSaveReason = lastTraceSaveReasonRef.current;
        formantDebug.lastTraceSkipReason = lastTraceSkipReasonRef.current;

        if (
          result.accepted &&
          result.filteredF1Hz !== null &&
          result.filteredF2Hz !== null
        ) {
          acceptedFormants = {
            f1Hz: result.filteredF1Hz,
            f2Hz: result.filteredF2Hz,
            confidence: result.confidence,
          };
          formantHistoryRef.current = [
            ...formantHistoryRef.current,
            acceptedFormants,
          ].slice(-48);
        }

        if (
          result.accepted &&
          result.displayF1Hz !== null &&
          result.displayF2Hz !== null
        ) {
          displayTraceFormants = {
            f1Hz: result.displayF1Hz,
            f2Hz: result.displayF2Hz,
            confidence: result.confidence,
          };
          if (now - lastTracePointAtRef.current >= TRACE_POINT_INTERVAL_MS) {
            const nextTrace = appendTracePoint(displayTraceFormants, "listening", now);
            lastTracePointAtRef.current = now;
            formantDebug.tracePointAdded = true;
            formantDebug.tracePointSkippedReason = null;
            formantDebug.currentTracePointCount = nextTrace.points.length;
          } else {
            formantDebug.tracePointAdded = false;
            formantDebug.tracePointSkippedReason = "trace_interval";
          }
        } else if (result.rejectedReason === "out_of_range") {
          formantDebug.tracePointAdded = false;
          formantDebug.tracePointSkippedReason = "out_of_range";
        } else {
          formantDebug.tracePointAdded = false;
          formantDebug.tracePointSkippedReason = "no_display_point";
        }
      }

      const stability = calculateStability(formantHistoryRef.current);
      const stabilizedFormants = getMedianFormants(formantHistoryRef.current);

      let nextFrame: AnalysisFrame = {
        selectedVowel,
        status: "unstable",
        statusMessage: "音が安定してから判定します。",
        formants: null,
        classification: null,
        stability,
        volume: effectiveVolume,
        rawRms,
        effectiveRms,
        softwareGain,
        dbfs,
        noiseFloor: currentNoiseFloor,
        currentThreshold,
        micSensitivity,
        frequencyData,
        formantDebug,
      };

      if (voicedDurationMs < modeConfig.initialIgnoreMs) {
        nextFrame = {
          ...nextFrame,
          status: "listening",
          statusMessage: "音が安定してから判定します。",
        };
      } else if (voicedDurationMs < modeConfig.minVoiceDurationMs) {
        nextFrame = {
          ...nextFrame,
          status: "too_short",
          statusMessage: "もう少し長く伸ばしてみましょう。",
        };
      } else if (!stabilizedFormants) {
        nextFrame = {
          ...nextFrame,
          status: "too_short",
          statusMessage: "母音を少し長く伸ばしてみましょう。",
        };
      } else if (!acceptedFormants || !isFormantInUsableRange(stabilizedFormants)) {
        nextFrame = {
          ...nextFrame,
          status: "unstable",
          statusMessage: "音が安定してから判定します。",
        };
      } else if (stability.score < MIN_STABILITY_SCORE) {
        nextFrame = {
          ...nextFrame,
          status: "unstable",
          statusMessage: "参考ヒントを表示しています。",
          formants: stabilizedFormants,
          classification: classifyVowel(stabilizedFormants, selectedVowel),
        };
      } else if (stabilizedFormants.confidence < modeConfig.minConfidence) {
        nextFrame = {
          ...nextFrame,
          status: "low_confidence",
          statusMessage: "今回は参考ヒントとして見てください。",
          formants: stabilizedFormants,
          classification: classifyVowel(stabilizedFormants, selectedVowel),
        };
      } else {
        const classification = classifyVowel(stabilizedFormants, selectedVowel);
        const combinedConfidence = Math.min(
          stabilizedFormants.confidence,
          classification.confidence,
        );
        const displayFormants = {
          ...stabilizedFormants,
          confidence: Math.round(combinedConfidence * 100) / 100,
        };

        nextFrame =
          combinedConfidence < modeConfig.minConfidence
            ? {
                ...nextFrame,
                status: "low_confidence",
                statusMessage: "今回は参考ヒントとして見てください。",
                formants: displayFormants,
                classification,
              }
            : {
                ...nextFrame,
                status: "ready",
                statusMessage: "参考判定を表示しています。",
                formants: displayFormants,
                classification,
              };
      }

      updateDisplayAnalysisResult(nextFrame, now);
    },
    [
      appendTracePoint,
      completedTraces.length,
      finishCurrentTrace,
      micSensitivity,
      pronunciationMode,
      selectedVowel,
      updateDisplayAnalysisResult,
    ],
  );

  const visibleAnalysisResult =
    rawAnalysisResult && displayAnalysisResult
      ? {
          ...rawAnalysisResult,
          status: displayAnalysisResult.isReferenceResult
            ? displayAnalysisResult.status
            : rawAnalysisResult.status,
          statusMessage:
            displayAnalysisResult.isReferenceResult
              ? displayAnalysisResult.statusMessage
              : rawAnalysisResult.status === "ready"
              ? displayAnalysisResult.statusMessage
              : rawAnalysisResult.statusMessage,
          isReferenceResult: displayAnalysisResult.isReferenceResult,
          formants: displayAnalysisResult.formants,
          classification: displayAnalysisResult.classification,
          stability: displayAnalysisResult.stability,
        }
      : pronunciationMode === "short" &&
          rawAnalysisResult &&
          rawAnalysisResult.status !== "calibrating_noise" &&
          rawAnalysisResult.status !== "no_voice" &&
          rawAnalysisResult.status !== "too_quiet" &&
          !rawAnalysisResult.isReferenceResult
        ? {
            ...rawAnalysisResult,
            status: "listening" as const,
            statusMessage: "発声が終わったら参考判定します。",
            formants: null,
            classification: null,
          }
      : rawAnalysisResult?.status === "ready"
        ? {
            ...rawAnalysisResult,
            status: "listening" as const,
            statusMessage: "安定したら判定します。",
            formants: null,
            classification: null,
          }
      : rawAnalysisResult ?? displayAnalysisResult;
  const audioTrack = audioSession?.stream.getAudioTracks()[0] ?? null;
  const audioContextState = audioSession?.audioContext.state ?? "none";
  const lastFrequencyDataUpdatedAt =
    audioDebug.lastFrequencyDataUpdatedAt === null
      ? "--"
      : new Date(audioDebug.lastFrequencyDataUpdatedAt).toLocaleTimeString();

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
              {APP_TITLE}
            </h1>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600">
              {APP_VERSION}
            </span>
            <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
              {APP_STAGE}
            </span>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            マイク入力から母音の響きの特徴を解析し、「あ・い・う・え・お」の位置関係を母音マップ上に表示する練習支援ツールです。
          </p>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            このツールは{APP_STAGE}です。表示される母音マップやアドバイスは、マイク環境・端末・発声条件によって変わる場合があります。結果は参考としてご利用ください。
          </div>
          <details className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-600">
            <summary className="cursor-pointer select-none font-medium text-zinc-800">
              使い方と注意
            </summary>
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              <div>
                <p className="font-medium text-zinc-800">使い方</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>練習したい母音を選びます。</li>
                  <li>マイクを開始して、選んだ母音を発声します。</li>
                  <li>母音マップ・周波数グラフ・アドバイスを参考に、発声を調整します。</li>
                </ol>
              </div>
              <div>
                <p className="font-medium text-zinc-800">音声データの扱い</p>
                <p className="mt-2">
                  初期版では、音声データはサーバーに送信せず、ブラウザ内で処理します。
                </p>
              </div>
              <div>
                <p className="font-medium text-zinc-800">ご利用上の注意</p>
                <p className="mt-2">
                  このツールは、発音練習を補助するためのものです。医療的な診断、聴覚・発語機能の評価、専門的な療育判断を行うものではありません。
                </p>
              </div>
            </div>
          </details>
          <p className="mt-3 text-xs text-zinc-500">
            {audioSession
              ? `AudioContext: ${audioSession.audioContext.sampleRate} Hz / FFT ${audioSession.analyser.fftSize}`
              : "AudioContext: 未開始"}
          </p>
          <details className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-500">
            <summary className="cursor-pointer select-none font-medium text-zinc-600">
              音声デバッグ
            </summary>
            <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              <p>hasAnalyser: {audioSession?.analyser ? "true" : "false"}</p>
              <p>audioContextState: {audioContextState}</p>
              <p>hasMediaStream: {audioSession?.stream ? "true" : "false"}</p>
              <p>audioTrackState: {audioTrack?.readyState ?? "none"}</p>
              <p>audioTrackEnabled: {audioTrack?.enabled ? "true" : "false"}</p>
              <p>
                lastRms:{" "}
                {audioDebug.lastRms === null
                  ? "--"
                  : audioDebug.lastRms.toFixed(5)}
              </p>
              <p>lastFrequencyDataUpdatedAt: {lastFrequencyDataUpdatedAt}</p>
              <p>
                animationLoopRunning:{" "}
                {audioDebug.animationLoopRunning ? "true" : "false"}
              </p>
            </div>
          </details>
        </header>

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <div className="flex flex-col gap-4">
            <VowelSelector
              selectedVowel={selectedVowel}
              onSelect={handleSelectVowel}
            />
            <MicControl
              status={micStatus}
              sensitivity={micSensitivity}
              pronunciationMode={pronunciationMode}
              onStatusChange={setMicStatus}
              onSensitivityChange={handleSensitivityChange}
              onPronunciationModeChange={handlePronunciationModeChange}
              onFrame={handleMicFrame}
              onSessionChange={handleSessionChange}
            />
            <div className="hidden lg:block">
              <ResultPanel frame={visibleAnalysisResult} compact />
            </div>
            <AdSlot className="mt-2 hidden lg:flex" />
          </div>

          <div className="grid min-w-0 gap-4">
            <AdvicePanel messages={adviceMessages} />
            <VowelMap
              selectedVowel={selectedVowel}
              formants={displayAnalysisResult?.formants ?? null}
              trail={formantTrail}
              currentTrace={currentTrace}
              completedTraces={completedTraces}
              showTraceHistory={showTraceHistory}
              onClearTraceHistory={handleClearTraceHistory}
              onToggleTraceHistory={setShowTraceHistory}
            />
            <SpectrumGraph data={rawAnalysisResult?.frequencyData ?? []} />
            <AdSlot className="lg:hidden" />
          </div>

          <div className="min-w-0 lg:hidden">
            <ResultPanel frame={visibleAnalysisResult} compact />
          </div>
        </div>
      </main>
    </div>
  );
}
