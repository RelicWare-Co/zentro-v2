import type { Config } from "vike/types";
import vikeReact from "vike-react/config";

// Default config (can be overridden by pages)
// https://vike.dev/config

const config: Config = {
  // https://vike.dev/head-tags
  title: "Zentro",
  description: "Sistema POS inteligente",
  lang: "es-CO",
  htmlAttributes: {
    suppressHydrationWarning: "true",
  },

  // The app shell is client-rendered. The Hono server remains for API, auth,
  // Vike routing/pageContext, and Zero query/mutate endpoints.
  ssr: false,

  extends: [vikeReact],
  passToClient: ["user", "zeroContext", "zeroCacheURL"],
};

export default config;
