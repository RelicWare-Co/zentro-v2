import type { Config } from "vike/types";

// Enable SSR for the public menu page so the catalog HTML is rendered
// server-side.  This overrides the global `ssr: false` in pages/+config.ts
// for just this route.  passToClient ensures the data() return value is
// available during client-side hydration and navigation.
const config: Config = {
  ssr: true,
  passToClient: ["data"],
};

export default config;
