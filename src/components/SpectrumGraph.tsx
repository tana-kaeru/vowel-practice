"use client";

import { useEffect, useRef } from "react";
import type { FrequencyBin } from "@/types/vowel";

type SpectrumGraphProps = {
  data: FrequencyBin[];
};

export default function SpectrumGraph({ data }: SpectrumGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#fafafa";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#e4e4e7";
    context.lineWidth = 1;

    for (let index = 0; index <= 4; index += 1) {
      const y = (height / 4) * index;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    if (data.length === 0) {
      context.fillStyle = "#71717a";
      context.font = "14px sans-serif";
      context.fillText("マイクを開始すると周波数分布を表示します", 16, 34);
      return;
    }

    const barWidth = width / data.length;
    data.forEach((bin, index) => {
      const barHeight = Math.max(2, bin.level * (height - 24));
      const x = index * barWidth;
      const y = height - barHeight;
      context.fillStyle = bin.frequencyHz < 1200 ? "#0f766e" : "#2563eb";
      context.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    });
  }, [data]);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-zinc-950">周波数グラフ</h2>
        <p className="mt-1 text-sm text-zinc-600">0から4kHzの簡易スペクトル</p>
      </div>
      <canvas
        ref={canvasRef}
        className="h-56 w-full rounded-lg border border-zinc-200 bg-zinc-50"
      />
    </section>
  );
}
