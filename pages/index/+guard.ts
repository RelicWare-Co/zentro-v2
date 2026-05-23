import { redirect } from "vike/abort";
import type { PageContextServer } from "vike/types";

export const guard = (pageContext: PageContextServer) => {
  if (!pageContext.user) {
    throw redirect("/login");
  }

  if (!pageContext.zeroContext) {
    throw redirect("/organization");
  }

  throw redirect("/dashboard");
};
