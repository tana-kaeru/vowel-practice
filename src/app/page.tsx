"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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
  calculateDbfs,
  getAnalysisVolume,
  getDisplayVolume,
  getEffectiveRms,
  getMedianFormants,
  getSoftwareGain,
  getVoiceThreshold,
  hasVoiceLikeInput,
  isFormantInUsableRange,
  MIN_ANALYSIS_DELAY_MS,
  MIN_CONFIDENCE,
  MIN_STABILITY_SCORE,
  MIN_STABLE_VOICE_MS,
  NOISE_FLOOR_CALIBRATION_MS,
} from "@/lib/analysis/stabilizeFormants";
import type {
  AnalysisFrame,
  FormantEstimate,
  FrequencyBin,
  MicSensitivity,
  MicStatus,
  VowelSymbol,
} from "@/types/vowel";

export default function Home() {
  const [selectedVowel, setSelectedVowel] = useState<VowelSymbol>("あ");
  const [micStatus, setMicStatus] = useState<MicStatus>("idle");
  const [micSensitivity, setMicSensitivity] =
    useState<MicSensitivity>("standard");
  const [audioSession, setAudioSession] =
    useState<AudioAnalyserSession | null>(null);
  const [frame, setFrame] = useState<AnalysisFrame | null>(null);
  const [formantTrail, setFormantTrail] = useState<FormantEstimate[]>([]);
  const formantHistoryRef = useRef<FormantEstimate[]>([]);
  const stabilizedFormantHistoryRef = useRef<FormantEstimate[]>([]);
  const utteranceStartAtRef = useRef<number | null>(null);
  const noiseCalibrationStartAtRef = useRef<number | null>(null);
  const noiseSamplesRef = useRef<number[]>([]);
  const noiseFloorRef = useRef<number | null>(null);
  const lastAnalysisAtRef = useRef(0);

  const resetAnalysis = useCallback(() => {
    setFrame(null);
    setFormantTrail([]);
    formantHistoryRef.current = [];
    stabilizedFormantHistoryRef.current = [];
    utteranceStartAtRef.current = null;
  }, []);

  const resetNoiseCalibration = useCallback(() => {
    noiseCalibrationStartAtRef.current = null;
    noiseSamplesRef.current = [];
    noiseFloorRef.current = null;
  }, []);

  const handleSelectVowel = useCallback((vowel: VowelSymbol) => {
    setSelectedVowel(vowel);
    resetAnalysis();
  }, [resetAnalysis]);

  const handleSensitivityChange = useCallback(
    (sensitivity: MicSensitivity) => {
      setMicSensitivity(sensitivity);
      resetAnalysis();
    },
    [resetAnalysis],
  );

  const handleSessionChange = useCallback(
    (session: AudioAnalyserSession | null) => {
      setAudioSession(session);
      resetAnalysis();
      resetNoiseCalibration();
    },
    [resetAnalysis, resetNoiseCalibration],
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
          setFrame({
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
          });
          return;
        }

        const samples = noiseSamplesRef.current;
        noiseFloorRef.current =
          samples.length === 0
            ? 0
            : samples.reduce((sum, item) => sum + item, 0) / samples.length;
      }

      const currentNoiseFloor = noiseFloorRef.current;
      const voiceDetected = hasVoiceLikeInput(rawRms, currentNoiseFloor);
      const hasEnoughEffectiveVolume = effectiveRms >= currentThreshold;

      if (!voiceDetected) {
        utteranceStartAtRef.current = null;
        formantHistoryRef.current = [];
        stabilizedFormantHistoryRef.current = [];
        setFormantTrail([]);
        setFrame({
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
        });
        return;
      }

      if (!hasEnoughEffectiveVolume) {
        utteranceStartAtRef.current = null;
        formantHistoryRef.current = [];
        stabilizedFormantHistoryRef.current = [];
        setFormantTrail([]);
        setFrame({
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
        });
        return;
      }

      if (utteranceStartAtRef.current === null) {
        utteranceStartAtRef.current = now;
        formantHistoryRef.current = [];
        stabilizedFormantHistoryRef.current = [];
      }

      const voicedDurationMs = now - utteranceStartAtRef.current;
      const analysisVolume = getAnalysisVolume(effectiveRms);
      const rawFormants = estimateFormants(frequencyData, analysisVolume);

      if (rawFormants && isFormantInUsableRange(rawFormants)) {
        formantHistoryRef.current = [
          ...formantHistoryRef.current,
          rawFormants,
        ].slice(-48);
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

      if (voicedDurationMs < MIN_ANALYSIS_DELAY_MS) {
        nextFrame = {
          ...nextFrame,
          status: "listening",
          statusMessage: "音が安定してから判定します。",
        };
      } else if (voicedDurationMs < MIN_STABLE_VOICE_MS) {
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
          statusMessage: "声の高さと大きさを一定にしてみましょう。",
          formants: stabilizedFormants,
        };
      } else if (stabilizedFormants.confidence < MIN_CONFIDENCE) {
        nextFrame = {
          ...nextFrame,
          status: "low_confidence",
          statusMessage: "音が安定してから判定します。",
          formants: stabilizedFormants,
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
          combinedConfidence < MIN_CONFIDENCE
            ? {
                ...nextFrame,
                status: "low_confidence",
                statusMessage: "音が安定してから判定します。",
                formants: displayFormants,
              }
            : {
                ...nextFrame,
                status: "ready",
                statusMessage: "判定できます。",
                formants: displayFormants,
                classification,
              };
      }

      if (nextFrame.formants) {
        stabilizedFormantHistoryRef.current = [
          ...stabilizedFormantHistoryRef.current,
          nextFrame.formants,
        ].slice(-18);
      }

      setFrame(nextFrame);
      setFormantTrail(stabilizedFormantHistoryRef.current);
    },
    [micSensitivity, selectedVowel],
  );

  const adviceMessages = useMemo(() => generateAdvice(frame), [frame]);

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
              onStatusChange={setMicStatus}
              onSensitivityChange={handleSensitivityChange}
              onFrame={handleMicFrame}
              onSessionChange={handleSessionChange}
            />
            <ResultPanel frame={frame} />
            <AdvicePanel messages={adviceMessages} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <VowelMap
              selectedVowel={selectedVowel}
              formants={frame?.formants ?? null}
              trail={formantTrail}
            />
            <SpectrumGraph data={frame?.frequencyData ?? []} />
          </div>
        </div>
      </main>
    </div>
  );
}
