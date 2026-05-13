import { createRequestLogger } from "evlog";
import type { TestDb } from "./test-db";
import type { user } from "../../database/drizzle/schema/auth.schema";

type UserRow = typeof user.$inferSelect;

export function buildMockContext(db: TestDb, user: UserRow, orgId?: string | null) {
	const now = new Date();
	return {
		headers: new Headers(),
		db,
		log: createRequestLogger({ method: "GET", path: "/test" }),
		session: {
			id: crypto.randomUUID(),
			token: crypto.randomUUID(),
			userId: user.id,
			expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24),
			createdAt: now,
			updatedAt: now,
			activeOrganizationId: orgId ?? undefined,
		},
		user,
	};
}
