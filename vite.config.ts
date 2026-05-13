import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
/// <reference types="@batijs/core/types" />

import vike from "vike/plugin";
import { defineConfig } from "vite";
import { frontmanPlugin } from "@frontman-ai/vite";
import evlog from "evlog/vite";

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
