export interface CatalogSearchProduct {
  barcode?: string | null;
  isFavorite?: boolean;
  name: string;
  sku?: string | null;
}

function normalizeSearchQuery(searchQuery?: string | null) {
  return searchQuery?.trim().toLowerCase() ?? "";
}

function getCatalogSearchRank(
  product: CatalogSearchProduct,
  normalizedSearch: string
) {
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

export function sortProductsByCatalogSearch<T extends CatalogSearchProduct>(
  products: T[],
  searchQuery?: string | null
): T[] {
  const normalizedSearch = normalizeSearchQuery(searchQuery);

  return [...products].sort((left, right) => {
    const leftFavoriteRank = left.isFavorite ? 0 : 1;
    const rightFavoriteRank = right.isFavorite ? 0 : 1;
    if (leftFavoriteRank !== rightFavoriteRank) {
      return leftFavoriteRank - rightFavoriteRank;
    }

    if (normalizedSearch) {
      const leftSearchRank = getCatalogSearchRank(left, normalizedSearch);
      const rightSearchRank = getCatalogSearchRank(right, normalizedSearch);
      if (leftSearchRank !== rightSearchRank) {
        return leftSearchRank - rightSearchRank;
      }
    }

    return left.name.localeCompare(right.name, "es");
  });
}
