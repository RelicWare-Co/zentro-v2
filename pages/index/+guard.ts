import { redirect } from "vike/abort";
import type { PageContextServer } from "vike/types";

export const guard = (pageContext: PageContextServer) => {
	if (!pageContext.user) {
		throw redirect("/login");
	}

	const session = pageContext.session as
		| ({ activeOrganizationId?: string | null } & typeof pageContext.session)
		| null;

	if (!session?.activeOrganizationId) {
		throw redirect("/organization");
	}

	throw redirect("/dashboard");
};
