import { Collapse, Switch } from "@mantine/core";
import type { ReactNode } from "react";

export function ProductFormCollapse({
  children,
  visible,
}: {
  children: ReactNode;
  visible: boolean;
}) {
  return (
    <Collapse
      animateOpacity
      expanded={visible}
      transitionDuration={200}
      transitionTimingFunction="cubic-bezier(0.25, 0.46, 0.45, 0.94)"
    >
      {children}
    </Collapse>
  );
}

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
  disabled,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
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
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.currentTarget.checked)}
      />
    </div>
  );
}
