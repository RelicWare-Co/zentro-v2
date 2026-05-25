export const AUTH_INPUT_BASE =
  "w-full pl-10 h-11 bg-[#1c1c1c] border-white/10 text-white placeholder:text-zinc-500 focus-visible:border-[var(--color-voltage)] focus-visible:ring-[var(--color-voltage)]/20 rounded-xl";

export type LoginPageMode = "login" | "register";

export interface JoinLinkPreview {
  canJoin?: boolean;
  label?: string | null;
  message?: string | null;
  organization?: {
    id?: string;
    name?: string;
    slug?: string;
  } | null;
  role?: string | null;
  status?: string;
}
