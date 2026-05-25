// Client-side helpers for constructing `ZeroOptions`.
//
// `createZeroOptions` is intentionally framework-agnostic so it can be reused
// from React, Solid, or plain TypeScript code. Vike-aware mounting lives in
// `./zero-provider.client.tsx`.

import type { ZeroContext } from "./context";
import { mutators } from "./mutators";
import { schema } from "./schema";

const DEFAULT_CACHE_URL = "http://localhost:4848";

/**
 * Returns the public URL where `zero-cache` is reachable from the browser.
 *
 * Reads `import.meta.env.VITE_ZERO_CACHE_URL` (Vite/Vike) and falls back to
 * the dev default. Production should pass a runtime URL from Vike pageContext
 * so Git-based deploys don't accidentally freeze the localhost fallback.
 */
export function getZeroCacheURL(): string {
  return import.meta.env.VITE_ZERO_CACHE_URL ?? DEFAULT_CACHE_URL;
}

export interface CreateZeroOptionsInput {
  /** Public zero-cache URL. Prefer the server-provided runtime value. */
  cacheURL?: string;
  /** Server-derived auth context. Pass `undefined` for logged-out clients. */
  context: ZeroContext | undefined;
  /** Authenticated user id. Pass `null` (not `'anon'`) for logged-out clients. */
  userID: string | null;
}

/**
 * Build the `ZeroOptions` object for the React/Solid `<ZeroProvider>` (or for
 * `new Zero(...)`). Keeping construction in one place ensures every entry
 * point sees the same schema/mutators/cacheURL/context wiring.
 *
 * The return type is intentionally inferred so the caller gets the precise
 * `MutatorRegistry` shape from `./mutators`. Use `ReturnType<typeof
 * createZeroOptions>` if you need to name the type.
 */
export function createZeroOptions({
  userID,
  context,
  cacheURL,
}: CreateZeroOptionsInput) {
  return {
    schema,
    mutators,
    userID: userID ?? null,
    cacheURL: cacheURL ?? getZeroCacheURL(),
    context,
    // `'idb'` is the default but we set it explicitly so future audits don't
    // have to wonder where local data goes.
    kvStore: "idb" as const,
    logLevel: "error" as const,
  };
}
