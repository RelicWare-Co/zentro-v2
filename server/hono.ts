import { dbMiddleware } from "./db-middleware";
import vike from "@vikejs/hono";
import { Hono } from "hono";

function getApp() {
  const app = new Hono();

  vike(app, [
    // Make database available in Context as `context.db`
    dbMiddleware,
  ]);

  return app;
}

export const app = getApp();
