import type { AdviceMessage } from "@/types/vowel";

type AdvicePanelProps = {
  messages: AdviceMessage[];
};

const levelClassName: Record<AdviceMessage["level"], string> = {
  info: "border-sky-100 bg-sky-50 text-sky-900",
  success: "border-emerald-100 bg-emerald-50 text-emerald-900",
  warning: "border-amber-100 bg-amber-50 text-amber-900",
};

export default function AdvicePanel({ messages }: AdvicePanelProps) {
  const visibleMessages = messages.slice(0, 2);
  const placeholders = Array.from({
    length: Math.max(0, 2 - visibleMessages.length),
  });
  const slotLabels = ["良い点", "次に試すこと"];

  return (
    <section className="min-h-[300px] rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:min-h-[320px]">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-zinc-950">アドバイス</h2>
        <p className="mt-1 text-sm text-zinc-600">練習用の簡易フィードバック</p>
      </div>
      <div className="space-y-2">
        {visibleMessages.map((message, index) => (
          <article
            key={message.id}
            className={`min-h-[88px] rounded-lg border p-3 ${levelClassName[message.level]}`}
          >
            <p className="text-[11px] font-medium text-current opacity-70">
              {slotLabels[index] ?? "ヒント"}
            </p>
            <h3 className="mt-1 text-sm font-semibold">{message.title}</h3>
            <p className="mt-1 text-sm leading-6">{message.body}</p>
          </article>
        ))}
        {placeholders.map((_, index) => (
          <article
            key={`placeholder-${index}`}
            aria-hidden="true"
            className="min-h-[88px] rounded-lg border border-transparent p-3 opacity-0"
          >
            <h3 className="text-sm font-semibold">placeholder</h3>
            <p className="mt-1 text-sm leading-6">placeholder</p>
          </article>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-zinc-500">
        この表示は医療的診断や専門的評価ではなく、発声練習のための簡易的な可視化です。
      </p>
    </section>
  );
}
