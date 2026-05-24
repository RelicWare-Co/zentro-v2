import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function CustomerFormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}
