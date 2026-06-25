import type { FormantEstimate, VowelSymbol } from "@/types/vowel";
import { VOWEL_TARGETS } from "@/lib/data/vowelTargets";

type VowelMapProps = {
  selectedVowel: VowelSymbol;
  formants: FormantEstimate | null;
};

function getPosition(f1Hz: number, f2Hz: number) {
  const x = ((f2Hz - 700) / 1800) * 100;
  const y = ((f1Hz - 250) / 650) * 100;

  return {
    x: Math.max(5, Math.min(95, x)),
    y: Math.max(5, Math.min(95, y)),
  };
}

export default function VowelMap({ selectedVowel, formants }: VowelMapProps) {
  const currentPosition = formants
    ? getPosition(formants.f1Hz, formants.f2Hz)
    : null;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-zinc-950">母音マップ</h2>
        <p className="mt-1 text-sm text-zinc-600">F1/F2の推定位置</p>
      </div>
      <div className="relative h-72 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
        <div className="absolute left-3 top-3 text-xs text-zinc-500">F1 低</div>
        <div className="absolute bottom-3 left-3 text-xs text-zinc-500">
          F1 高
        </div>
        <div className="absolute bottom-3 right-3 text-xs text-zinc-500">
          F2 高
        </div>
        {VOWEL_TARGETS.map((target) => {
          const position = getPosition(target.f1Hz, target.f2Hz);
          const isSelected = target.vowel === selectedVowel;

          return (
            <div
              key={target.vowel}
              className={`absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm ${target.colorClass} ${
                isSelected ? "ring-4 ring-zinc-900/20" : "opacity-70"
              }`}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
            >
              {target.label}
            </div>
          );
        })}
        {currentPosition ? (
          <div
            className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-zinc-950 shadow-lg"
            style={{
              left: `${currentPosition.x}%`,
              top: `${currentPosition.y}%`,
            }}
            aria-label="現在の推定位置"
          />
        ) : null}
      </div>
    </section>
  );
}
