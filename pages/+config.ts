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

  extends: [vikeReact],
  passToClient: ["user"],
};

export default config;
