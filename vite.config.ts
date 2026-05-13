import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

/// <reference types="@batijs/core/types" />

import { frontmanPlugin } from "@frontman-ai/vite";
import evlog from "evlog/vite";
import vike from "vike/plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    frontmanPlugin({ host: "api.frontman.sh" }),
    vike(),
    react(),
    tailwindcss(),
    evlog({ service: "zentro" }),
  ],

  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname,
    },
  },
});
