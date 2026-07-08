import { and, eq, isNull, ne } from "drizzle-orm";
import type { Database } from "@/database/drizzle/db";
import { organization } from "@/database/drizzle/schema/auth.schema";
import { category, product } from "@/database/drizzle/schema/inventory.schema";
import type { PublicCatalog } from "@/features/orders/orders.schema";

export type PublicCatalogDbExecutor = Pick<Database, "select">;

export async function getPublicCatalogBySlug({
  db,
  slug,
}: {
  db: PublicCatalogDbExecutor;
  slug: string;
}): Promise<PublicCatalog | null> {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) {
    return null;
  }

  const [org] = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    })
    .from(organization)
    .where(eq(organization.slug, normalizedSlug))
    .limit(1);

  if (!org) {
    return null;
  }

  const products = await db
    .select({
      id: product.id,
      name: product.name,
      price: product.price,
      categoryId: product.categoryId,
      categoryName: category.name,
    })
    .from(product)
    .leftJoin(category, eq(product.categoryId, category.id))
    .where(
      and(
        eq(product.organizationId, org.id),
        isNull(product.deletedAt),
        eq(product.isModifier, false),
        ne(product.accountingTreatment, "passthrough")
      )
    )
    .orderBy(category.name, product.name);

  return {
    organizationName: org.name,
    organizationSlug: org.slug,
    products: products.map((row) => ({
      id: row.id,
      name: row.name,
      price: row.price,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
    })),
  };
}
