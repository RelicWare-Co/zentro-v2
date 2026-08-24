import type { ReactNode } from "react";

export function FilterSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="space-y-3">
      <h3 className="font-semibold text-xs text-zinc-400 uppercase tracking-[0.16em]">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
