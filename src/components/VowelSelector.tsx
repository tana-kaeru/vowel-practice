import type { VowelSymbol } from "@/types/vowel";
import { VOWEL_TARGETS } from "@/lib/data/vowelTargets";

type VowelSelectorProps = {
  selectedVowel: VowelSymbol;
  onSelect: (vowel: VowelSymbol) => void;
};

export default function VowelSelector({
  selectedVowel,
  onSelect,
}: VowelSelectorProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-zinc-950">母音選択</h2>
        <p className="mt-1 text-sm text-zinc-600">
          練習する日本語母音を選んでください。
        </p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {VOWEL_TARGETS.map((target) => {
          const isSelected = target.vowel === selectedVowel;

          return (
            <button
              key={target.vowel}
              type="button"
              onClick={() => onSelect(target.vowel)}
              className={`flex aspect-square items-center justify-center rounded-lg border text-2xl font-semibold transition ${
                isSelected
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-zinc-50 text-zinc-900 hover:border-zinc-400 hover:bg-white"
              }`}
              aria-pressed={isSelected}
            >
              {target.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
