import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
/// <reference types="@batijs/core/types" />

import vike from "vike/plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vike(), react(), tailwindcss()],

  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname,
    },
  },
});
