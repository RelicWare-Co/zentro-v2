import type { TestDb } from "./test-db";
import { user } from "../../database/drizzle/schema/auth.schema";

type UserRow = typeof user.$inferSelect;

export function buildMockContext(db: TestDb, user: UserRow, orgId: string) {
	const now = new Date();
	return {
		headers: new Headers(),
		db,
		session: {
			id: crypto.randomUUID(),
			token: crypto.randomUUID(),
			userId: user.id,
			expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24),
			createdAt: now,
			updatedAt: now,
			activeOrganizationId: orgId,
		},
		user,
	};
}
