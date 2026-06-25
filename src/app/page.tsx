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
import type {
  AnalysisFrame,
  FormantEstimate,
  FrequencyBin,
  MicStatus,
  VowelSymbol,
} from "@/types/vowel";

export default function Home() {
  const [selectedVowel, setSelectedVowel] = useState<VowelSymbol>("あ");
  const [micStatus, setMicStatus] = useState<MicStatus>("idle");
  const [audioSession, setAudioSession] =
    useState<AudioAnalyserSession | null>(null);
  const [frame, setFrame] = useState<AnalysisFrame | null>(null);
  const formantHistoryRef = useRef<FormantEstimate[]>([]);

  const handleSelectVowel = useCallback((vowel: VowelSymbol) => {
    setSelectedVowel(vowel);
    setFrame(null);
    formantHistoryRef.current = [];
  }, []);

  const handleMicFrame = useCallback(
    ({
      frequencyData,
      volume,
    }: {
      frequencyData: FrequencyBin[];
      volume: number;
    }) => {
      const formants = estimateFormants(frequencyData, selectedVowel, volume);
      formantHistoryRef.current = [...formantHistoryRef.current, formants].slice(
        -48,
      );
      const classification = classifyVowel(formants, selectedVowel);
      const stability = calculateStability(formantHistoryRef.current);

      setFrame({
        selectedVowel,
        formants,
        classification,
        stability,
        volume,
        frequencyData,
      });
    },
    [selectedVowel],
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
              onStatusChange={setMicStatus}
              onFrame={handleMicFrame}
              onSessionChange={setAudioSession}
            />
            <ResultPanel frame={frame} />
            <AdvicePanel messages={adviceMessages} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <VowelMap
              selectedVowel={selectedVowel}
              formants={frame?.formants ?? null}
            />
            <SpectrumGraph data={frame?.frequencyData ?? []} />
          </div>
        </div>
      </main>
    </div>
  );
}
