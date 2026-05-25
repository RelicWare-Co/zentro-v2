import type { EvlogVariables } from "evlog/hono";
import { Hono } from "hono";

const DEFAULT_ZERO_CACHE_URL = "http://localhost:4848";

function getRuntimeEnv() {
  const bun = (globalThis as { Bun?: { env: NodeJS.ProcessEnv } }).Bun;
  return bun?.env ?? process.env;
}

export function getPublicZeroCacheURL(): string {
  const env = getRuntimeEnv();

  return (
    env.ZERO_CACHE_URL ?? env.VITE_ZERO_CACHE_URL ?? DEFAULT_ZERO_CACHE_URL
  );
}

export function createRuntimeConfigApp() {
  const app = new Hono<EvlogVariables>();

  app.get("/", (c) =>
    c.json({
      zeroCacheURL: getPublicZeroCacheURL(),
    })
  );

  return app;
}
