import StabilityMeter from "@/components/StabilityMeter";
import { getVowelTarget } from "@/lib/data/vowelTargets";
import type { AnalysisFrame } from "@/types/vowel";

type ResultPanelProps = {
  frame: AnalysisFrame | null;
  compact?: boolean;
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

export default function ResultPanel({ frame, compact = false }: ResultPanelProps) {
  const selectedTarget = frame ? getVowelTarget(frame.selectedVowel) : null;
  const nearestTarget = frame?.classification
    ? getVowelTarget(frame.classification.nearestVowel)
    : null;
  const confidence = frame?.formants?.confidence ?? null;
  const volumeScore = frame ? Math.round(frame.volume * 100) : 0;
  const formantDebug = frame?.formantDebug ?? null;

  if (compact) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-950">結果</h2>
          {frame?.isReferenceResult ? (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
              参考判定
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">状態</p>
            <p className="mt-1 text-sm font-semibold text-zinc-950">
              {frame?.status === "ready"
                ? "判定中"
                : frame
                  ? "保留中"
                  : "--"}
            </p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">対象</p>
            <p className="mt-1 text-xl font-semibold text-zinc-950">
              {selectedTarget?.label ?? "--"}
            </p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">近い母音</p>
            <p className="mt-1 text-xl font-semibold text-zinc-950">
              {nearestTarget?.label ?? "--"}
            </p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">confidence</p>
            <p className="mt-1 text-sm font-semibold text-zinc-950">
              {confidence === null ? "--" : `${Math.round(confidence * 100)}%`}
            </p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">F1</p>
            <p className="mt-1 text-sm font-semibold text-zinc-950">
              {frame?.formants ? `${frame.formants.f1Hz} Hz` : "--"}
            </p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">F2</p>
            <p className="mt-1 text-sm font-semibold text-zinc-950">
              {frame?.formants ? `${frame.formants.f2Hz} Hz` : "--"}
            </p>
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-zinc-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-600">音量</span>
            <span className="text-xs font-semibold text-zinc-950">
              {frame ? `${volumeScore}%` : "--"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full rounded-full bg-teal-600 transition-all"
              style={{ width: `${volumeScore}%` }}
            />
          </div>
        </div>
        <details className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <summary className="cursor-pointer text-xs font-medium text-zinc-600">
            デバッグ表示
          </summary>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] leading-5 text-zinc-500">
              <p>rawF1: {formantDebug?.rawF1Hz ?? "--"}</p>
              <p>rawF2: {formantDebug?.rawF2Hz ?? "--"}</p>
              <p>filteredF1: {formantDebug?.filteredF1Hz ?? "--"}</p>
              <p>filteredF2: {formantDebug?.filteredF2Hz ?? "--"}</p>
              <p>displayF1: {formantDebug?.displayF1Hz ?? "--"}</p>
              <p>displayF2: {formantDebug?.displayF2Hz ?? "--"}</p>
              <p>
                accepted: {formantDebug ? String(formantDebug.accepted) : "--"}
              </p>
              <p>reason: {formantDebug?.rejectedReason ?? "--"}</p>
              <p>recent: {formantDebug?.recentAcceptedPointCount ?? "--"}</p>
              <p>rejected: {formantDebug?.rejectedFrameCount ?? "--"}</p>
              <p>jump: {formantDebug?.jumpDistance ?? "--"}</p>
              <p>confidence: {formantDebug?.confidence ?? "--"}</p>
              <p>displayStepF1: {formantDebug?.displayStepF1Hz ?? "--"}</p>
              <p>displayStepF2: {formantDebug?.displayStepF2Hz ?? "--"}</p>
              <p>
                wasClamped: {formantDebug ? String(formantDebug.wasClamped) : "--"}
              </p>
              <p>clampReason: {formantDebug?.clampReason ?? "--"}</p>
              <p>
                traceAdded:{" "}
                {formantDebug ? String(formantDebug.tracePointAdded) : "--"}
              </p>
              <p>traceSkip: {formantDebug?.tracePointSkippedReason ?? "--"}</p>
              <p>currentTrace: {formantDebug?.currentTracePointCount ?? "--"}</p>
              <p>completed: {formantDebug?.completedTraceCount ?? "--"}</p>
              <p>traceSaved: {formantDebug?.lastTraceSaveReason ?? "--"}</p>
              <p>traceSaveSkip: {formantDebug?.lastTraceSkipReason ?? "--"}</p>
            </div>
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
        </details>
      </section>
    );
  }

  return (
    <section className="min-h-[520px] rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-4 min-h-[48px]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-950">結果</h2>
          {frame?.isReferenceResult ? (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
              参考判定
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          {frame?.statusMessage ?? "マイク開始後に表示します。"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-h-[82px] rounded-lg bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">状態</p>
          <p className="mt-1 text-lg font-semibold text-zinc-950">
            {frame?.status === "ready"
              ? "判定中"
              : frame
                ? "保留中"
                : "--"}
          </p>
        </div>
        <div className="min-h-[82px] rounded-lg bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">対象母音</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">
            {selectedTarget?.label ?? "--"}
          </p>
        </div>
        <div className="min-h-[82px] rounded-lg bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">近い母音</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">
            {nearestTarget?.label ?? "--"}
          </p>
        </div>
        <div className="min-h-[82px] rounded-lg bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">音量</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">
            {frame ? `${Math.round(frame.volume * 100)}%` : "--"}
          </p>
        </div>
        <div className="min-h-[82px] rounded-lg bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">F1</p>
          <p className="mt-1 text-lg font-semibold text-zinc-950">
            {frame?.formants ? `${frame.formants.f1Hz} Hz` : "--"}
          </p>
        </div>
        <div className="min-h-[82px] rounded-lg bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">F2</p>
          <p className="mt-1 text-lg font-semibold text-zinc-950">
            {frame?.formants ? `${frame.formants.f2Hz} Hz` : "--"}
          </p>
        </div>
        <div className="min-h-[82px] rounded-lg bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">目標範囲</p>
          <p className="mt-1 text-lg font-semibold text-zinc-950">
            {frame?.classification
              ? frame.classification.isInsideTargetRange
                ? "範囲内"
                : "調整中"
              : "--"}
          </p>
        </div>
        <div className="min-h-[82px] rounded-lg bg-zinc-50 p-3">
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
        {formantDebug ? (
          <details className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[11px] leading-5 text-zinc-500">
            <summary className="cursor-pointer text-xs font-medium text-zinc-600">
              フォルマントデバッグ
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
              <p>rawF1: {formantDebug.rawF1Hz ?? "--"}</p>
              <p>rawF2: {formantDebug.rawF2Hz ?? "--"}</p>
              <p>filteredF1: {formantDebug.filteredF1Hz ?? "--"}</p>
              <p>filteredF2: {formantDebug.filteredF2Hz ?? "--"}</p>
              <p>displayF1: {formantDebug.displayF1Hz ?? "--"}</p>
              <p>displayF2: {formantDebug.displayF2Hz ?? "--"}</p>
              <p>accepted: {String(formantDebug.accepted)}</p>
              <p>reason: {formantDebug.rejectedReason ?? "--"}</p>
              <p>recent: {formantDebug.recentAcceptedPointCount}</p>
              <p>rejected: {formantDebug.rejectedFrameCount}</p>
              <p>jump: {formantDebug.jumpDistance ?? "--"}</p>
              <p>confidence: {formantDebug.confidence ?? "--"}</p>
              <p>displayStepF1: {formantDebug.displayStepF1Hz ?? "--"}</p>
              <p>displayStepF2: {formantDebug.displayStepF2Hz ?? "--"}</p>
              <p>wasClamped: {String(formantDebug.wasClamped)}</p>
              <p>clampReason: {formantDebug.clampReason ?? "--"}</p>
              <p>traceAdded: {String(formantDebug.tracePointAdded)}</p>
              <p>traceSkip: {formantDebug.tracePointSkippedReason ?? "--"}</p>
              <p>currentTrace: {formantDebug.currentTracePointCount}</p>
              <p>completed: {formantDebug.completedTraceCount}</p>
              <p>traceSaved: {formantDebug.lastTraceSaveReason ?? "--"}</p>
              <p>traceSaveSkip: {formantDebug.lastTraceSkipReason ?? "--"}</p>
            </div>
          </details>
        ) : null}
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
