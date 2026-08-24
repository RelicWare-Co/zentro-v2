import type { ReactNode } from "react";

export function FilterField({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
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
