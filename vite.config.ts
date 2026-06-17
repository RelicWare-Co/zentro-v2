import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";

/// <reference types="@batijs/core/types" />

import evlog from "evlog/vite";
import vike from "vike/plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    vike(),
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
    tailwindcss(),
    evlog({ service: "zentro" }),
  ],

  server: {
    // Bind on all interfaces so the dev server is reachable when running inside
    // a container (harmless for host dev too).
    host: true,
    allowedHosts: ["host.docker.internal"],
    // Bind-mounted source over Docker on macOS doesn't reliably emit fs events;
    // fall back to polling so HMR keeps working. Only enabled in docker dev.
    ...(process.env.DOCKER_DEV
      ? { watch: { usePolling: true, interval: 300 } }
      : {}),
  },

  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname,
    },
  },
});
