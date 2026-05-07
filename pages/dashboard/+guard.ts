import type { PageContextServer } from "vike/types";
import { redirect } from "vike/abort";

export const guard = (pageContext: PageContextServer) => {
	if (!pageContext.user) {
		throw redirect("/login");
	}
};
