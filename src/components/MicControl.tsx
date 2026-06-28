"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioAnalyser } from "@/lib/audio/createAudioAnalyser";
import type { AudioAnalyserSession } from "@/lib/audio/createAudioAnalyser";
import { getFrequencyData } from "@/lib/audio/getFrequencyData";
import { getTimeDomainData } from "@/lib/audio/getTimeDomainData";
import { getRmsLevel } from "@/lib/audio/getVolumeLevel";
import {
  MIC_SENSITIVITY_CONFIG,
  PRONUNCIATION_MODE_CONFIG,
} from "@/lib/analysis/stabilizeFormants";
import type {
  FrequencyBin,
  MicSensitivity,
  MicStatus,
  PronunciationMode,
} from "@/types/vowel";

type MicFrame = {
  frequencyData: FrequencyBin[];
  rms: number;
};

type MicControlProps = {
  status: MicStatus;
  sensitivity: MicSensitivity;
  pronunciationMode: PronunciationMode;
  onStatusChange: (status: MicStatus) => void;
  onSensitivityChange: (sensitivity: MicSensitivity) => void;
  onPronunciationModeChange: (mode: PronunciationMode) => void;
  onFrame: (frame: MicFrame) => void;
  onSessionChange?: (session: AudioAnalyserSession | null) => void;
};

function getMicrophoneErrorMessage(error: unknown) {
  if (!(error instanceof DOMException)) {
    return error instanceof Error
      ? error.message
      : "マイクの開始に失敗しました。";
  }

  if (error.name === "NotAllowedError" || error.name === "SecurityError") {
    return "マイクの使用が許可されていません。ブラウザの権限設定を確認してください。";
  }

  if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
    return "利用できるマイクが見つかりません。接続状態を確認してください。";
  }

  if (error.name === "NotReadableError" || error.name === "TrackStartError") {
    return "マイクを開始できませんでした。ほかのアプリで使用中でないか確認してください。";
  }

  return error.message || "マイクの開始に失敗しました。";
}

export default function MicControl({
  status,
  sensitivity,
  pronunciationMode,
  onStatusChange,
  onSensitivityChange,
  onPronunciationModeChange,
  onFrame,
  onSessionChange,
}: MicControlProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sessionRef = useRef<AudioAnalyserSession | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const onFrameRef = useRef(onFrame);
  const onSessionChangeRef = useRef(onSessionChange);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    onSessionChangeRef.current = onSessionChange;
  }, [onSessionChange]);

  const stopSession = useCallback(async () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const session = sessionRef.current;
    sessionRef.current = null;

    if (session) {
      session.source.disconnect();
      session.stream.getTracks().forEach((track) => track.stop());
      if (session.audioContext.state !== "closed") {
        await session.audioContext.close();
      }
    }
  }, []);

  const stop = useCallback(async () => {
    await stopSession();
    onSessionChangeRef.current?.(null);

    onStatusChange("idle");
  }, [onStatusChange, stopSession]);

  const start = useCallback(async () => {
    setErrorMessage(null);
    onStatusChange("requesting");

    try {
      await stopSession();
      const session = await createAudioAnalyser();

      if (!mountedRef.current) {
        session.source.disconnect();
        session.stream.getTracks().forEach((track) => track.stop());
        if (session.audioContext.state !== "closed") {
          await session.audioContext.close();
        }
        return;
      }

      sessionRef.current = session;
      onSessionChangeRef.current?.(session);
      onStatusChange("recording");

      const tick = () => {
        const currentSession = sessionRef.current;

        if (!currentSession) {
          return;
        }

        if (currentSession.audioContext.state === "suspended") {
          void currentSession.audioContext.resume();
        }

        const timeDomainData = getTimeDomainData(currentSession.analyser);
        const rms = getRmsLevel(timeDomainData);
        const frequencyData = getFrequencyData(
          currentSession.analyser,
          currentSession.audioContext.sampleRate,
        );

        onFrameRef.current({ frequencyData, rms });
        animationFrameRef.current = requestAnimationFrame(tick);
      };

      tick();
    } catch (error) {
      console.error("Failed to start microphone", error);
      await stopSession();
      onSessionChangeRef.current?.(null);
      onStatusChange("error");
      setErrorMessage(getMicrophoneErrorMessage(error));
    }
  }, [onStatusChange, stopSession]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      onSessionChangeRef.current?.(null);
      void stopSession();
    };
  }, [stopSession]);

  const isRecording = status === "recording";
  const isRequesting = status === "requesting";
  const isError = status === "error";

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">マイク操作</h2>
          <p className="mt-1 text-sm text-zinc-600">
            初期版では、音声データはサーバーに送信せず、ブラウザ内で処理します。
          </p>
        </div>
        <span
          className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
            isRecording
              ? "bg-emerald-100 text-emerald-800"
              : isRequesting
                ? "bg-sky-100 text-sky-800"
                : isError
                  ? "bg-red-100 text-red-800"
              : "bg-zinc-100 text-zinc-700"
          }`}
        >
          {isRecording
            ? "使用中"
            : isRequesting
              ? "許可待ち"
              : isError
                ? "エラー"
                : "停止中"}
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
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-zinc-600">マイク感度</p>
        <div className="grid grid-cols-4 gap-2">
          {(["low", "standard", "high", "max"] as const).map((item) => {
            const isSelected = item === sensitivity;

            return (
              <button
                key={item}
                type="button"
                onClick={() => onSensitivityChange(item)}
                className={`h-9 rounded-lg border px-3 text-sm font-medium transition ${
                  isSelected
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {MIC_SENSITIVITY_CONFIG[item].label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          AirPodsなどのBluetoothマイクでは「高」または「最大」にすると安定する場合があります。
        </p>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-zinc-600">判定モード</p>
        <div className="grid grid-cols-2 gap-2">
          {(["standard", "short"] as const).map((item) => {
            const isSelected = item === pronunciationMode;

            return (
              <button
                key={item}
                type="button"
                onClick={() => onPronunciationModeChange(item)}
                className={`h-9 rounded-lg border px-3 text-sm font-medium transition ${
                  isSelected
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {PRONUNCIATION_MODE_CONFIG[item].label}
              </button>
            );
          })}
        </div>
        {pronunciationMode === "short" ? (
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            短めモードでは、短い発声から参考判定します。標準モードより結果が揺れやすい場合があります。
          </p>
        ) : null}
      </div>
      {errorMessage ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
