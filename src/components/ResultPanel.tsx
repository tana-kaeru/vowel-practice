import StabilityMeter from "@/components/StabilityMeter";
import { getVowelTarget } from "@/lib/data/vowelTargets";
import type { AnalysisFrame } from "@/types/vowel";

type ResultPanelProps = {
  frame: AnalysisFrame | null;
};

function getConfidenceLabel(confidence: number | null) {
  if (confidence === null) {
    return "--";
  }

  if (confidence < 0.45) {
    return "低い";
  }

  if (confidence < 0.7) {
    return "中くらい";
  }

  return "良い";
}

export default function ResultPanel({ frame }: ResultPanelProps) {
  const selectedTarget = frame ? getVowelTarget(frame.selectedVowel) : null;
  const nearestTarget = frame?.classification
    ? getVowelTarget(frame.classification.nearestVowel)
    : null;
  const confidence = frame?.formants?.confidence ?? null;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-950">結果</h2>
        <p className="mt-1 text-sm text-zinc-600">
          {frame?.statusMessage ?? "マイク開始後に表示します。"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">状態</p>
          <p className="mt-1 text-lg font-semibold text-zinc-950">
            {frame?.status === "ready"
              ? "判定中"
              : frame
                ? "保留中"
                : "--"}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">対象母音</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">
            {selectedTarget?.label ?? "--"}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">近い母音</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">
            {nearestTarget?.label ?? "--"}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">音量</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">
            {frame ? `${Math.round(frame.volume * 100)}%` : "--"}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">F1</p>
          <p className="mt-1 text-lg font-semibold text-zinc-950">
            {frame?.formants ? `${frame.formants.f1Hz} Hz` : "--"}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">F2</p>
          <p className="mt-1 text-lg font-semibold text-zinc-950">
            {frame?.formants ? `${frame.formants.f2Hz} Hz` : "--"}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">目標範囲</p>
          <p className="mt-1 text-lg font-semibold text-zinc-950">
            {frame?.classification
              ? frame.classification.isInsideTargetRange
                ? "範囲内"
                : "調整中"
              : "--"}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">confidence</p>
          <p className="mt-1 text-lg font-semibold text-zinc-950">
            {confidence === null
              ? "--"
              : `${Math.round(confidence * 100)}% / ${getConfidenceLabel(
                  confidence,
                )}`}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <StabilityMeter
          volume={frame?.volume ?? null}
          rawRms={frame?.rawRms ?? null}
          effectiveRms={frame?.effectiveRms ?? null}
          softwareGain={frame?.softwareGain ?? null}
          dbfs={frame?.dbfs ?? null}
          noiseFloor={frame?.noiseFloor ?? null}
          currentThreshold={frame?.currentThreshold ?? null}
          status={frame?.status ?? null}
          stability={frame?.stability ?? null}
        />
      </div>
    </section>
  );
}
