import { VOLUME_THRESHOLDS } from "@/lib/analysis/stabilizeFormants";
import type { AnalysisStatus, StabilityResult } from "@/types/vowel";

type StabilityMeterProps = {
  volume: number | null;
  rawRms: number | null;
  effectiveRms: number | null;
  softwareGain: number | null;
  dbfs: number | null;
  noiseFloor: number | null;
  currentThreshold: number | null;
  status: AnalysisStatus | null;
  stability: StabilityResult | null;
};

function formatRms(value: number | null) {
  return value === null ? "--" : value.toFixed(4);
}

function getVolumeGuide(
  effectiveRms: number | null,
  currentThreshold: number | null,
) {
  if (effectiveRms === null) {
    return {
      label: "未入力",
      className: "bg-zinc-300",
      message: "マイク開始後に表示します",
    };
  }

  if (currentThreshold !== null && effectiveRms < currentThreshold) {
    return {
      label: "小さめ",
      className: "bg-amber-500",
      message:
        "マイクに入る音量が小さめです。Bluetoothマイクでは感度を高または最大にすると安定する場合があります。",
    };
  }

  if (effectiveRms > VOLUME_THRESHOLDS.tooLoud) {
    return {
      label: "大きめ",
      className: "bg-red-500",
      message: "音割れを避けるため、少し小さめに発声してください。",
    };
  }

  if (effectiveRms < VOLUME_THRESHOLDS.good) {
    return {
      label: "検出中",
      className: "bg-sky-500",
      message: "もう少し長く、または少しはっきり発音してみましょう。",
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
  rawRms,
  effectiveRms,
  softwareGain,
  dbfs,
  noiseFloor,
  currentThreshold,
  status,
  stability,
}: StabilityMeterProps) {
  const volumeScore = volume === null ? 0 : Math.round(volume * 100);
  const stabilityScore = stability ? Math.round(stability.score * 100) : 0;
  const guide = getVolumeGuide(effectiveRms, currentThreshold);

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
      <details className="mt-2 text-[11px] leading-5 text-zinc-400">
        <summary className="cursor-pointer select-none">
          デバッグ値を表示
        </summary>
        <p className="mt-1">
          rawRMS: {formatRms(rawRms)} / effectiveRMS:{" "}
          {formatRms(effectiveRms)} / meterPercent:{" "}
          {volume === null ? "--" : `${volumeScore}%`} / gain:{" "}
          {softwareGain === null ? "--" : `x${softwareGain}`} / noiseFloor:{" "}
          {formatRms(noiseFloor)} / tooQuietThreshold:{" "}
          {formatRms(currentThreshold)} / goodVolumeThreshold:{" "}
          {formatRms(VOLUME_THRESHOLDS.good)} / dBFS:{" "}
          {dbfs === null ? "--" : `${dbfs.toFixed(1)} dB`} / status:{" "}
          {status ?? "--"}
        </p>
      </details>
    </div>
  );
}
