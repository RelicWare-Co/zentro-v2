import { Switch } from "@mantine/core";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Dark carbon settings card container (replaces the shadcn Card composition). */
export function SettingsCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-6 text-[var(--color-photon)]">
      <div className="space-y-1.5">
        <h3 className="flex items-center gap-2 font-semibold">
          {Icon ? (
            <Icon className="size-4 text-[var(--color-voltage)]" />
          ) : null}
          {title}
        </h3>
        {description ? (
          <p className="text-sm text-zinc-400">{description}</p>
        ) : null}
      </div>
      <div className="mt-6 space-y-6">{children}</div>
    </div>
  );
}

export function SettingsSummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-6 text-[var(--color-photon)]">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)]">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-zinc-400">{title}</p>
          <p className="mt-1 truncate font-semibold text-white text-xl tracking-tight">
            {value}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm text-zinc-400 leading-6">{description}</p>
    </div>
  );
}

export function SettingsToggleControl({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Switch
        checked={checked}
        color="voltage.5"
        disabled={disabled}
        onChange={(event) => {
          const next = event.currentTarget.checked;
          onCheckedChange(next);
        }}
      />
      <span className="text-sm text-zinc-300">{label}</span>
    </div>
  );
}

export function SettingsToggleRow({
  id,
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id?: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-black/20 p-4">
      <div>
        <label className="font-medium text-white" htmlFor={id}>
          {title}
        </label>
        <p className="mt-1 text-sm text-zinc-400">{description}</p>
      </div>
      <Switch
        checked={checked}
        color="voltage.5"
        disabled={disabled}
        id={id}
        onChange={(event) => {
          const next = event.currentTarget.checked;
          onCheckedChange(next);
        }}
      />
    </div>
  );
}
