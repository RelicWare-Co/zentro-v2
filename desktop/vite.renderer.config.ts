import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const desktopRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("../", import.meta.url));

export default defineConfig({
  build: {
    rolldownOptions: {
      input: path.join(desktopRoot, "src/renderer/index.html"),
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": repoRoot,
      // The desktop shell only needs Button's default <button> path. Keep the
      // local renderer from bundling the full Radix meta-package dependency tree.
      "radix-ui": path.join(desktopRoot, "src/renderer/radix-ui-shim.tsx"),
    },
  },
});
