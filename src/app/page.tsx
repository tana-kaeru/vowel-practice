"use client";

import { useCallback, useRef, useState } from "react";
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
import {
  ADVICE_MIN_DISPLAY_MS,
  calculateDbfs,
  DISPLAY_FORMANT_SMOOTHING,
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
  SWITCH_DISTANCE_MARGIN,
} from "@/lib/analysis/stabilizeFormants";
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
  const formantHistoryRef = useRef<FormantEstimate[]>([]);
  const stabilizedFormantHistoryRef = useRef<FormantEstimate[]>([]);
  const currentTraceRef = useRef<VowelTrace | null>(null);
  const displayAnalysisResultRef = useRef<AnalysisFrame | null>(null);
  const displayFormantsRef = useRef<FormantEstimate | null>(null);
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
    candidateRef.current = null;
    lastDisplayUpdateAtRef.current = 0;
    lastAdviceUpdateAtRef.current = 0;
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

  const getSmoothedDisplayFormants = useCallback(
    (formants: FormantEstimate) => {
      const previous = displayFormantsRef.current;

      if (!previous) {
        return formants;
      }

      return {
        f1Hz: Math.round(
          previous.f1Hz * (1 - DISPLAY_FORMANT_SMOOTHING) +
            formants.f1Hz * DISPLAY_FORMANT_SMOOTHING,
        ),
        f2Hz: Math.round(
          previous.f2Hz * (1 - DISPLAY_FORMANT_SMOOTHING) +
            formants.f2Hz * DISPLAY_FORMANT_SMOOTHING,
        ),
        confidence: formants.confidence,
      };
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

      const smoothedFormants = forceReferenceDisplay
        ? nextFrame.formants
        : getSmoothedDisplayFormants(nextFrame.formants);
      const smoothedClassification = classifyVowel(
        smoothedFormants,
        selectedVowel,
      );
      const nextDisplayFrame: AnalysisFrame = {
        ...nextFrame,
        statusMessage: forceReferenceDisplay
          ? nextFrame.statusMessage
          : "安定した判定を表示しています。",
        formants: smoothedFormants,
        classification: smoothedClassification,
      };

      displayAnalysisResultRef.current = nextDisplayFrame;
      displayFormantsRef.current = smoothedFormants;
      lastDisplayUpdateAtRef.current = now;
      stabilizedFormantHistoryRef.current = [
        ...stabilizedFormantHistoryRef.current,
        smoothedFormants,
      ].slice(-18);

      setDisplayAnalysisResult(nextDisplayFrame);
      setFormantTrail(stabilizedFormantHistoryRef.current);
      updateAdviceMessages(nextDisplayFrame, now, forceReferenceDisplay);
    },
    [
      getSmoothedDisplayFormants,
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

      const modeConfig = PRONUNCIATION_MODE_CONFIG[trace.mode];
      const durationMs = now - trace.startedAt;
      const candidatePoints = trace.points.filter(
        (point) => point.confidence >= modeConfig.minConfidence,
      );
      const representative = getMedianFormants(
        candidatePoints.map((point) => ({
          f1Hz: point.f1Hz,
          f2Hz: point.f2Hz,
          confidence: point.confidence,
        })),
      );
      const completedTrace: VowelTrace = {
        ...trace,
        endedAt: now,
        result: representative,
        isCurrent: false,
      };

      currentTraceRef.current = null;
      setCurrentTrace(null);
      setCompletedTraces((previous) =>
        [...previous, completedTrace].slice(-MAX_COMPLETED_TRACES),
      );

      if (
        trace.mode !== "short" ||
        durationMs < modeConfig.minVoiceDurationMs ||
        !representative
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

      if (now - lastAnalysisAtRef.current < 100) {
        return;
      }

      lastAnalysisAtRef.current = now;
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
        const noVoiceFrame: AnalysisFrame = {
          selectedVowel,
          status: "no_voice",
          statusMessage: "声らしい入力を待っています。",
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
        updateDisplayAnalysisResult({
          selectedVowel,
          status: "too_quiet",
          statusMessage:
            "声は検出されていますが、解析には少し足りない状態です。",
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
        currentTraceRef.current = null;
        setCurrentTrace(null);
      }

      const voicedDurationMs = now - utteranceStartAtRef.current;
      const modeConfig = PRONUNCIATION_MODE_CONFIG[pronunciationMode];
      const analysisVolume = getAnalysisVolume(effectiveRms);
      const rawFormants = estimateFormants(frequencyData, analysisVolume);

      if (rawFormants && isFormantInUsableRange(rawFormants)) {
        formantHistoryRef.current = [
          ...formantHistoryRef.current,
          rawFormants,
        ].slice(-48);
        appendTracePoint(rawFormants, "listening", now);
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
      } else if (!rawFormants || !isFormantInUsableRange(stabilizedFormants)) {
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
                statusMessage: "判定できます。",
                formants: displayFormants,
                classification,
              };
      }

      updateDisplayAnalysisResult(nextFrame, now);
    },
    [
      appendTracePoint,
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

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-teal-700">v0.1 prototype</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
            母音発音練習
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            日本語の「あ・い・う・え・お」を対象に、ブラウザ内で音声特徴を可視化する練習支援ツールです。医療的診断や専門的評価ではありません。
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            {audioSession
              ? `AudioContext: ${audioSession.audioContext.sampleRate} Hz / FFT ${audioSession.analyser.fftSize}`
              : "AudioContext: 未開始"}
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
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
            <ResultPanel frame={visibleAnalysisResult} />
            <AdvicePanel messages={adviceMessages} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
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
          </div>
        </div>
      </main>
    </div>
  );
}
