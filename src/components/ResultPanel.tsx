import StabilityMeter from "@/components/StabilityMeter";
import type { AnalysisFrame } from "@/types/vowel";

type ResultPanelProps = {
  frame: AnalysisFrame | null;
};

export default function ResultPanel({ frame }: ResultPanelProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-950">結果</h2>
        <p className="mt-1 text-sm text-zinc-600">現在フレームの簡易推定</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">推定母音</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">
            {frame?.classification.vowel ?? "--"}
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
            {frame ? `${frame.formants.f1Hz} Hz` : "--"}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">F2</p>
          <p className="mt-1 text-lg font-semibold text-zinc-950">
            {frame ? `${frame.formants.f2Hz} Hz` : "--"}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <StabilityMeter stability={frame?.stability ?? null} />
      </div>
    </section>
  );
}
