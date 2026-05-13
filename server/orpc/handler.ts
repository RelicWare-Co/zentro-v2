import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { router } from "./routers";

export const orpcHandler = new OpenAPIHandler(router, {
	interceptors: [
		async ({ context, next }) => {
			try {
				return await next();
			} catch (error) {
				context.log.error(error as Error);
				throw error;
			}
		},
	],
	plugins: [
		new OpenAPIReferencePlugin({
			docsProvider: "scalar",
			docsPath: "/docs",
			specPath: "/openapi.json",
			docsTitle: "Zentro API Reference",
			docsConfig: {
				theme: "deepSpace",
				layout: "modern",
				forceDarkModeState: "dark",
				metaData: {
					title: "Zentro API Reference",
					description: "Interactive API documentation for the Zentro platform",
				},
				defaultOpenAllTags: true,
				showOperationId: true,
				documentDownloadType: "both",
				withDefaultFonts: true,
			},
			schemaConverters: [new ZodToJsonSchemaConverter()],
			specGenerateOptions: {
				info: {
					title: "Zentro API",
					version: "1.0.0",
					description: "OpenAPI endpoints for the Zentro Vike application.",
				},
			},
		}),
	],
});
