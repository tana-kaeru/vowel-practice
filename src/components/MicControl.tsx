"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioAnalyser } from "@/lib/audio/createAudioAnalyser";
import type { AudioAnalyserSession } from "@/lib/audio/createAudioAnalyser";
import { getFrequencyData } from "@/lib/audio/getFrequencyData";
import { getTimeDomainData } from "@/lib/audio/getTimeDomainData";
import { getVolumeLevel } from "@/lib/audio/getVolumeLevel";
import type { FrequencyBin, MicStatus } from "@/types/vowel";

type MicFrame = {
  frequencyData: FrequencyBin[];
  volume: number;
};

type MicControlProps = {
  status: MicStatus;
  onStatusChange: (status: MicStatus) => void;
  onFrame: (frame: MicFrame) => void;
};

export default function MicControl({
  status,
  onStatusChange,
  onFrame,
}: MicControlProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sessionRef = useRef<AudioAnalyserSession | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const stop = useCallback(async () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const session = sessionRef.current;
    sessionRef.current = null;

    if (session) {
      session.source.disconnect();
      session.stream.getTracks().forEach((track) => track.stop());
      await session.audioContext.close();
    }

    onStatusChange("idle");
  }, [onStatusChange]);

  const start = useCallback(async () => {
    setErrorMessage(null);
    onStatusChange("requesting");

    try {
      const session = await createAudioAnalyser();
      sessionRef.current = session;
      onStatusChange("recording");

      const tick = () => {
        const currentSession = sessionRef.current;

        if (!currentSession) {
          return;
        }

        const timeDomainData = getTimeDomainData(currentSession.analyser);
        const volume = getVolumeLevel(timeDomainData);
        const frequencyData = getFrequencyData(
          currentSession.analyser,
          currentSession.audioContext.sampleRate,
        );

        onFrame({ frequencyData, volume });
        animationFrameRef.current = requestAnimationFrame(tick);
      };

      tick();
    } catch (error) {
      onStatusChange("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "マイクの開始に失敗しました。",
      );
    }
  }, [onFrame, onStatusChange]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      const session = sessionRef.current;
      if (session) {
        session.source.disconnect();
        session.stream.getTracks().forEach((track) => track.stop());
        void session.audioContext.close();
      }
    };
  }, []);

  const isRecording = status === "recording";
  const isRequesting = status === "requesting";

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">マイク操作</h2>
          <p className="mt-1 text-sm text-zinc-600">
            音声はブラウザ内で解析し、保存や送信はしません。
          </p>
        </div>
        <span
          className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
            isRecording
              ? "bg-emerald-100 text-emerald-800"
              : "bg-zinc-100 text-zinc-700"
          }`}
        >
          {isRecording ? "解析中" : "停止中"}
        </span>
      </div>
      <button
        type="button"
        onClick={isRecording ? stop : start}
        disabled={isRequesting}
        className="flex h-12 w-full items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {isRequesting ? "マイク許可を確認中" : isRecording ? "停止" : "開始"}
      </button>
      {errorMessage ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
