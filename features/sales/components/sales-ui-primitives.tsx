import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function SalesFilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label
        className="font-medium text-xs text-zinc-500 uppercase tracking-[0.16em]"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function SalesCompactMetricCard({
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

export function SalesIndeterminateProgressBar({ active }: { active: boolean }) {
  return (
    <>
      <style>{`
				@keyframes sales-progress-primary {
					0% { transform: translateX(-140%) scaleX(0.55); }
					100% { transform: translateX(340%) scaleX(1); }
				}
				@keyframes sales-progress-secondary {
					0% { transform: translateX(-180%) scaleX(0.35); }
					100% { transform: translateX(250%) scaleX(0.8); }
				}
			`}</style>
      <div
        aria-hidden="true"
        className={`mt-2 h-1 overflow-hidden rounded-full bg-white/5 transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
      >
        <div className="relative size-full">
          <div
            className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-[var(--color-voltage)]/85"
            style={
              active
                ? {
                    animation:
                      "sales-progress-primary 1.15s cubic-bezier(0.4, 0, 0.2, 1) infinite",
                  }
                : undefined
            }
          />
          <div
            className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-[var(--color-voltage)]/35"
            style={
              active
                ? {
                    animation:
                      "sales-progress-secondary 1.15s cubic-bezier(0.4, 0, 0.2, 1) infinite",
                  }
                : undefined
            }
          />
        </div>
      </div>
    </>
  );
}
