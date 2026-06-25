import type { StabilityResult } from "@/types/vowel";

type StabilityMeterProps = {
  volume: number | null;
  stability: StabilityResult | null;
};

function getVolumeGuide(volume: number | null) {
  if (volume === null) {
    return {
      label: "未入力",
      className: "bg-zinc-300",
      message: "マイク開始後に表示します",
    };
  }

  if (volume < 0.12) {
    return {
      label: "小さすぎる",
      className: "bg-amber-500",
      message: "もう少し大きく、またはマイクに近づいて発声してください。",
    };
  }

  if (volume > 0.82) {
    return {
      label: "大きすぎる",
      className: "bg-red-500",
      message: "音割れを避けるため、少し小さめに発声してください。",
    };
  }

  return {
    label: "ちょうどよい",
    className: "bg-teal-600",
    message: "この音量を保ったまま母音を伸ばしてください。",
  };
}

export default function StabilityMeter({
  volume,
  stability,
}: StabilityMeterProps) {
  const volumeScore = volume === null ? 0 : Math.round(volume * 100);
  const stabilityScore = stability ? Math.round(stability.score * 100) : 0;
  const guide = getVolumeGuide(volume);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700">音量レベル</span>
        <span className="text-sm font-semibold text-zinc-950">
          {volume === null ? "--" : `${volumeScore}%`}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all ${guide.className}`}
          style={{ width: `${volumeScore}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        目安: {guide.label} / {guide.message}
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        安定度:{" "}
        {stability
          ? `${stability.label} (${stabilityScore}%) / 揺れ ${stability.variation}`
          : "--"}
      </p>
    </div>
  );
}
