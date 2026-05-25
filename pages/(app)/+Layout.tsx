import type { ReactNode } from "react";

// ZeroProvider now mounts from the root `pages/+Layout.tsx` when
// `pageContext.zeroContext` is available so AppLayout and `/organization`
// can consume Zero queries without duplicating the provider gate.

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return children;
}
