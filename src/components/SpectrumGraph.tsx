"use client";

import { useEffect, useRef } from "react";
import type { FrequencyBin } from "@/types/vowel";

type SpectrumGraphProps = {
  data: FrequencyBin[];
  maxFrequencyHz?: number;
  minDecibels?: number;
  maxDecibels?: number;
};

export default function SpectrumGraph({
  data,
  maxFrequencyHz = 5000,
  minDecibels = -100,
  maxDecibels = -20,
}: SpectrumGraphProps) {
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

    const chartLeft = 42;
    const chartRight = 12;
    const chartTop = 14;
    const chartBottom = 28;
    const chartWidth = width - chartLeft - chartRight;
    const chartHeight = height - chartTop - chartBottom;
    const decibelRange = maxDecibels - minDecibels;

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#fafafa";
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "#e4e4e7";
    context.fillStyle = "#71717a";
    context.font = "11px sans-serif";
    context.lineWidth = 1;

    for (let index = 0; index <= 4; index += 1) {
      const y = chartTop + (chartHeight / 4) * index;
      const decibels = Math.round(maxDecibels - (decibelRange / 4) * index);
      context.beginPath();
      context.moveTo(chartLeft, y);
      context.lineTo(width - chartRight, y);
      context.stroke();
      context.fillText(`${decibels}`, 8, y + 4);
    }

    if (data.length === 0) {
      context.fillStyle = "#71717a";
      context.font = "14px sans-serif";
      context.fillText("マイクを開始すると周波数分布を表示します", 16, 34);
      return;
    }

    const visibleData = data.filter((bin) => bin.frequencyHz <= maxFrequencyHz);

    context.fillStyle = "#52525b";
    for (let index = 0; index <= 5; index += 1) {
      const frequency = Math.round((maxFrequencyHz / 5) * index);
      const x = chartLeft + (chartWidth / 5) * index;
      context.fillText(`${frequency / 1000}k`, x - 8, height - 8);
    }

    context.beginPath();
    context.strokeStyle = "#0f766e";
    context.lineWidth = 2;

    visibleData.forEach((bin, index) => {
      const x = chartLeft + (bin.frequencyHz / maxFrequencyHz) * chartWidth;
      const normalized =
        decibelRange > 0
          ? (bin.decibels - minDecibels) / decibelRange
          : bin.level;
      const y =
        chartTop + chartHeight - Math.max(0, Math.min(1, normalized)) * chartHeight;

      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.stroke();

    context.lineTo(chartLeft + chartWidth, chartTop + chartHeight);
    context.lineTo(chartLeft, chartTop + chartHeight);
    context.closePath();
    context.fillStyle = "rgba(15, 118, 110, 0.14)";
    context.fill();
  }, [data, maxDecibels, maxFrequencyHz, minDecibels]);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-zinc-950">周波数グラフ</h2>
        <p className="mt-1 text-sm text-zinc-600">
          0から{Math.round(maxFrequencyHz / 1000)}kHzのdBスペクトル
        </p>
      </div>
      <canvas
        ref={canvasRef}
        className="h-56 w-full rounded-lg border border-zinc-200 bg-zinc-50"
      />
    </section>
  );
}
