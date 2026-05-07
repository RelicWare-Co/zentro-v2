import { base } from "./context";
import { dbMiddleware } from "./middlewares/db";
import { authMiddleware } from "./middlewares/auth";
import { requireOrgMiddleware } from "./middlewares/require-org";

export const pub = base.use(dbMiddleware);
export const authed = pub.use(authMiddleware);
export const orgRequired = authed.use(requireOrgMiddleware);
