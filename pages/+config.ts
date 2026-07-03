import type { Config } from "vike/types";
import vikeReact from "vike-react/config";

// Default config (can be overridden by pages)
// https://vike.dev/config

const config: Config = {
  // https://vike.dev/head-tags
  favicon: "/favicon.svg",
  lang: "es-CO",
  viewport: null,

  // The app shell is client-rendered. The Hono server remains for API, auth,
  // Vike routing/pageContext, and Zero query/mutate endpoints.
  ssr: false,
  clientRouting: true,

  // Prefetch static assets when links enter the viewport so navigation feels
  // instant on touch devices (no hover).  Requires clientRouting.
  // https://vike.dev/prefetchStaticAssets
  prefetchStaticAssets: "viewport",

  extends: [vikeReact],
  passToClient: ["user", "zeroContext", "zeroCacheURL"],
};

export default config;
