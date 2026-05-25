import { Hono } from "hono";
import { z } from "zod";
import { db } from "@/database/drizzle/db";
import { getJoinLinkPreviewByToken } from "./join-link-preview.server";

const joinPreviewQuerySchema = z.object({
  token: z.string().trim().min(1).max(255),
});

export function createOrganizationApp() {
  const app = new Hono();

  app.get("/join-link-preview", async (c) => {
    const parsed = joinPreviewQuerySchema.safeParse({
      token: c.req.query("token") ?? "",
    });

    if (!parsed.success) {
      return c.json(
        {
          status: "not-found",
          canJoin: false,
          message: "Este enlace ya no es válido.",
          organization: null,
          role: null,
          label: null,
          expiresAt: null,
        },
        200
      );
    }

    const result = await getJoinLinkPreviewByToken({
      db,
      token: parsed.data.token,
    });

    return c.json(result);
  });

  return app;
}
