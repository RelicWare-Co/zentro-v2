import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { orpc } from "./browser";

export const orpcQuery = createTanstackQueryUtils(orpc, {
  path: ["orpc"],
});
