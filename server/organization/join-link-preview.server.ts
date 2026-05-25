import { eq } from "drizzle-orm";
import type { Database } from "@/database/drizzle/db";
import { organization, organizationJoinLink } from "@/database/drizzle/schema";
import {
  buildJoinLinkPreview,
  type JoinLinkPreview,
} from "@/features/organization/organization.shared";

export type JoinLinkPreviewDbExecutor = Pick<Database, "select">;

export async function getJoinLinkPreviewByToken({
  db,
  token,
}: {
  db: JoinLinkPreviewDbExecutor;
  token: string;
}): Promise<JoinLinkPreview> {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return buildJoinLinkPreview({ row: null });
  }

  const [row] = await db
    .select({
      id: organizationJoinLink.id,
      role: organizationJoinLink.role,
      label: organizationJoinLink.label,
      expiresAt: organizationJoinLink.expiresAt,
      revokedAt: organizationJoinLink.revokedAt,
      useCount: organizationJoinLink.useCount,
      maxUses: organizationJoinLink.maxUses,
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
    })
    .from(organizationJoinLink)
    .innerJoin(
      organization,
      eq(organizationJoinLink.organizationId, organization.id)
    )
    .where(eq(organizationJoinLink.token, normalizedToken))
    .limit(1);

  return buildJoinLinkPreview({ row: row ?? null });
}
