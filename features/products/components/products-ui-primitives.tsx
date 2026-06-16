import { Switch } from "@mantine/core";
import type { ReactNode } from "react";

export function ProductsField({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="font-medium text-sm" htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

export function ProductsToggleLine({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-black/20 p-4">
      <div>
        <p className="font-medium text-white">{title}</p>
        <p className="text-sm text-zinc-400">{description}</p>
      </div>
      <Switch
        checked={checked}
        color="voltage.5"
        onChange={(event) => onCheckedChange(event.currentTarget.checked)}
      />
    </div>
  );
}
