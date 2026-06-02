import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const ZENTRO_MARK_PATH =
  "M287.89 355.33h282.59L287.89 666.96V778.8h448.22V666.96h-284.3l284.3-318.46V245.2H287.89v110.13Z";

export function ZentroMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="240 235 500 555"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={ZENTRO_MARK_PATH} />
    </svg>
  );
}

export function ZentroAppIcon({
  className,
  overlay,
  size = "md",
}: {
  className?: string;
  overlay?: ReactNode;
  size?: "md" | "lg";
}) {
  const boxClass = size === "lg" ? "size-14 rounded-2xl" : "size-11 rounded-xl";

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center bg-[var(--color-voltage)] text-[#0a0e14] shadow-[0_0_24px_-6px] shadow-[var(--color-voltage)]/40",
        boxClass,
        className
      )}
    >
      <ZentroMark className={size === "lg" ? "size-8" : "size-6"} />
      {overlay ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-[var(--color-void)]/55">
          {overlay}
        </div>
      ) : null}
    </div>
  );
}

export function ZentroBrandHeader({
  subtitle,
  title,
}: {
  subtitle?: string;
  title: string;
}) {
  return (
    <div className="min-w-0 space-y-1">
      {subtitle ? (
        <p className="font-medium text-[var(--color-voltage)] text-xs uppercase tracking-[0.14em]">
          {subtitle}
        </p>
      ) : null}
      <h1 className="font-semibold text-base text-white">{title}</h1>
    </div>
  );
}
