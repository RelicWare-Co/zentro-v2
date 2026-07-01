import type { MiddlewareHandler } from "hono";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000;

const MAX_REQUESTS: Record<string, number> = {
  "/catalog": 30,
  "/orders": 5,
};

const DEFAULT_MAX = 20;

export function publicRateLimit(): MiddlewareHandler {
  return async (c, next) => {
    const path = new URL(c.req.url).pathname;
    let route = "";
    if (path.endsWith("/orders")) {
      route = "/orders";
    } else if (path.endsWith("/catalog")) {
      route = "/catalog";
    }
    const max = route ? (MAX_REQUESTS[route] ?? DEFAULT_MAX) : DEFAULT_MAX;

    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";

    const key = `${ip}:${route || "default"}`;
    const now = Date.now();
    const entry = buckets.get(key);

    if (!entry || now > entry.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
      await next();
      return;
    }

    entry.count++;
    if (entry.count > max) {
      c.header("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return c.json(
        { error: "Demasiadas solicitudes. Inténtalo de nuevo en un minuto." },
        429
      );
    }

    await next();
  };
}
