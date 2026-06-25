import type { StabilityResult } from "@/types/vowel";

type StabilityMeterProps = {
  stability: StabilityResult | null;
};

export default function StabilityMeter({ stability }: StabilityMeterProps) {
  const score = stability ? Math.round(stability.score * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700">安定度</span>
        <span className="text-sm font-semibold text-zinc-950">
          {stability ? `${score}%` : "--"}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-teal-600 transition-all"
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {stability
          ? `判定: ${stability.label} / 揺れ ${stability.variation}`
          : "マイク開始後に表示します"}
      </p>
    </div>
  );
}
