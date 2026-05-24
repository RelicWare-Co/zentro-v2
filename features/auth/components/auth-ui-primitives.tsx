import type { ReactNode } from "react";

export function AuthLabelWithRequired({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label className="font-semibold text-xs text-zinc-200" htmlFor={htmlFor}>
      {children} <span className="text-red-500">*</span>
    </label>
  );
}

export function AuthInlineErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 font-medium text-red-200 text-sm">
      {message}
    </div>
  );
}

export function AuthSubmitButton({
  disabled,
  label,
}: {
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      className="h-11 w-full cursor-pointer rounded-xl bg-[#dfff06] font-semibold text-[15px] text-black transition-colors hover:bg-[#c9e605] disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      type="submit"
    >
      {label}
    </button>
  );
}
