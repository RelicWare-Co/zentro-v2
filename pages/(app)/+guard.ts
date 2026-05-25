import { redirect } from "vike/abort";
import type { PageContextServer } from "vike/types";

export const guard = (pageContext: PageContextServer) => {
  if (!pageContext.user) {
    throw redirect("/login");
  }

  if (!pageContext.zeroContext?.orgID) {
    throw redirect("/organization");
  }
};
