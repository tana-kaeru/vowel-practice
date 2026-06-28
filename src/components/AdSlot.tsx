type AdSlotProps = {
  className?: string;
};

export default function AdSlot({ className = "" }: AdSlotProps) {
  return (
    <aside
      className={`pointer-events-none flex min-h-[250px] max-h-[280px] w-full items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-white p-4 text-[11px] font-medium tracking-[0.18em] text-zinc-400 shadow-sm ${className}`}
      aria-label="Sponsored"
    >
      SPONSORED
    </aside>
  );
}
