import type { PageContextServer } from "vike/types";
import type { PublicCatalog } from "@/features/orders/orders.schema";
import { getPublicCatalogBySlug } from "@/features/orders/public-catalog.server";

export interface Data {
  catalog: PublicCatalog | null;
  slug: string;
}

export async function data(pageContext: PageContextServer): Promise<Data> {
  const slug = pageContext.routeParams.slug ?? "";
  const db = pageContext.db;

  const catalog = await getPublicCatalogBySlug({ db, slug });

  return { catalog, slug };
}
