import type { LucideIcon } from "lucide-react";

export function ShiftsCompactMetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)]">
        <Icon aria-hidden="true" className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-xs text-zinc-400">{title}</p>
        <p className="truncate font-semibold text-lg text-white tabular-nums">
          {value}
        </p>
      </div>
    </div>
  );
}
