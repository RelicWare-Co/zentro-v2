import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function DashboardPanelShell({
  title,
  description,
  headerAside,
  children,
}: {
  title: string;
  description: string;
  headerAside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-5">
      <div
        className={
          headerAside
            ? "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            : undefined
        }
      >
        <div>
          <h2 className="font-semibold text-base text-white">{title}</h2>
          <p className="text-sm text-zinc-400">{description}</p>
        </div>
        {headerAside}
      </div>
      {children}
    </div>
  );
}

export function CompactStatCard({
  title,
  value,
  description,
  highlight,
  icon: Icon,
}: {
  title: string;
  value: string;
  description?: string;
  highlight?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex flex-col justify-between gap-2 rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-3 sm:gap-3 sm:p-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] sm:h-10 sm:w-10">
          <Icon aria-hidden="true" className="size-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-[10px] text-zinc-500 uppercase tracking-wider sm:text-[11px]">
            {title}
          </p>
          <p className="mt-0.5 truncate font-semibold text-base text-white tabular-nums sm:text-lg">
            {value}
          </p>
        </div>
      </div>
      {description || highlight ? (
        <div className="hidden text-[11px] sm:block">
          {description ? (
            <p className="truncate text-zinc-400">{description}</p>
          ) : null}
          {highlight ? (
            <p className="mt-0.5 truncate text-zinc-500">{highlight}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function MiniMetric({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-2 font-semibold text-lg text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{description}</p>
    </div>
  );
}

export function MetricItem({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="p-3">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-1 font-semibold text-base text-white">{value}</p>
      <p className="text-xs text-zinc-500">{description}</p>
    </div>
  );
}

export function EmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 border-dashed px-4 py-8 text-center text-sm text-zinc-500">
      {children}
    </div>
  );
}
