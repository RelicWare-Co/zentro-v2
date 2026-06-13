import type { Product } from "@/features/pos/types";
import type {
  Category as ZeroCategory,
  Product as ZeroProduct,
} from "@/zero/schema";

export type PosProductWithCategory = ZeroProduct & {
  readonly category?: ZeroCategory | null;
};

export interface PaginatePosProductsInput {
  cursor?: number;
  limit?: number;
}

export interface PaginatedPosProducts {
  data: Product[];
  hasMore: boolean;
  nextCursor: number | null;
  total: number;
}

export function buildPosProduct(row: PosProductWithCategory): Product {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId ?? null,
    categoryName: row.category?.name ?? "Sin categoría",
    sku: row.sku ?? null,
    barcode: row.barcode ?? null,
    price: row.price ?? 0,
    taxRate: row.taxRate ?? 0,
    trackInventory: row.trackInventory ?? true,
    stock: row.stock ?? 0,
    isModifier: row.isModifier ?? false,
    isFavorite: row.isFavorite ?? false,
  };
}

function normalizePosSearchQuery(searchQuery?: string | null) {
  return searchQuery?.trim().toLowerCase() ?? "";
}

function getPosSearchRank(product: Product, normalizedSearch: string) {
  if (!normalizedSearch) {
    return 0;
  }

  const barcode = (product.barcode ?? "").toLowerCase();
  const sku = (product.sku ?? "").toLowerCase();
  const name = product.name.toLowerCase();

  if (barcode === normalizedSearch) {
    return 0;
  }
  if (sku === normalizedSearch) {
    return 1;
  }
  if (name === normalizedSearch) {
    return 2;
  }
  return 3;
}

export function sortPosProducts(
  products: Product[],
  searchQuery?: string | null
): Product[] {
  const normalizedSearch = normalizePosSearchQuery(searchQuery);

  return [...products].sort((left, right) => {
    const leftFavoriteRank = left.isFavorite ? 0 : 1;
    const rightFavoriteRank = right.isFavorite ? 0 : 1;
    if (leftFavoriteRank !== rightFavoriteRank) {
      return leftFavoriteRank - rightFavoriteRank;
    }

    if (normalizedSearch) {
      const leftSearchRank = getPosSearchRank(left, normalizedSearch);
      const rightSearchRank = getPosSearchRank(right, normalizedSearch);
      if (leftSearchRank !== rightSearchRank) {
        return leftSearchRank - rightSearchRank;
      }
    }

    const nameComparison = left.name.localeCompare(right.name, "es-CO");
    if (nameComparison !== 0) {
      return nameComparison;
    }

    return left.id.localeCompare(right.id);
  });
}

function normalizePosLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 50, 1), 100);
}

function normalizePosCursor(cursor?: number) {
  return Math.max(cursor ?? 0, 0);
}

export function paginatePosProducts(
  products: Product[],
  input: PaginatePosProductsInput = {}
): PaginatedPosProducts {
  const limit = normalizePosLimit(input.limit);
  const cursor = normalizePosCursor(input.cursor);
  const pageRows = products.slice(cursor, cursor + limit);
  const hasMore = cursor + limit < products.length;
  const nextCursor = hasMore ? cursor + limit : null;

  return {
    data: pageRows,
    total: products.length,
    hasMore,
    nextCursor,
  };
}

export function buildPosProductPages(
  products: Product[],
  loadedPageCount: number,
  limit = 100
) {
  const pages: PaginatedPosProducts[] = [];

  for (let pageIndex = 0; pageIndex < loadedPageCount; pageIndex += 1) {
    const page = paginatePosProducts(products, {
      limit,
      cursor: pageIndex * limit,
    });
    pages.push(page);
    if (!page.hasMore) {
      break;
    }
  }

  return pages;
}
