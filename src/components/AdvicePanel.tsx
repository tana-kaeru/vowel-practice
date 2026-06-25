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
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-zinc-950">アドバイス</h2>
        <p className="mt-1 text-sm text-zinc-600">練習用の簡易フィードバック</p>
      </div>
      <div className="space-y-2">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`rounded-lg border p-3 ${levelClassName[message.level]}`}
          >
            <h3 className="text-sm font-semibold">{message.title}</h3>
            <p className="mt-1 text-sm leading-6">{message.body}</p>
          </article>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-zinc-500">
        この表示は医療的診断や専門的評価ではなく、発声練習のための簡易的な可視化です。
      </p>
    </section>
  );
}
