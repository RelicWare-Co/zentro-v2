import { useRef } from "react";
import { usePageContext } from "vike-react/usePageContext";
import type { ZeroContext } from "@/src/zero/context";

/**
 * Stable Zero auth context for client hooks.
 *
 * `pageContext.zeroContext` can briefly be null during client-side navigation
 * even while ZeroProvider still holds the previous context. Reuse the last
 * known value so queries do not flip to error/empty states mid-transition.
 */
export function usePageZeroContext(): ZeroContext | null {
  const pageContext = usePageContext();
  const latestZeroContextRef = useRef(pageContext.zeroContext);

  if (!pageContext.user) {
    latestZeroContextRef.current = null;
  } else if (pageContext.zeroContext) {
    latestZeroContextRef.current = pageContext.zeroContext;
  }

  return pageContext.zeroContext ?? latestZeroContextRef.current;
}
