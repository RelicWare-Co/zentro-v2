import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
	throw new Error("Missing DATABASE_URL in .env file");
}

export default defineConfig({
	dialect: "turso",
	schema: "./database/drizzle/schema/index.ts",
	out: "./database/migrations",

	dbCredentials: {
		url: process.env.DATABASE_URL,
		authToken: process.env.DATABASE_AUTH_TOKEN,
	},
});
