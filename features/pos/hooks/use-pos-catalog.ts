import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import {
  buildPosProduct,
  buildPosProductPages,
  type PosProductWithCategory,
  sortPosProducts,
} from "@/features/pos/pos.shared";
import type { Category } from "@/features/pos/types";
import {
  getEnabledPaymentMethods,
  parseOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";
import {
  getZeroQueryError,
  useZeroMutation,
  waitForZeroMutation,
} from "@/lib/use-zero-mutation";
import { mutators } from "@/src/zero/mutators";
import { queries } from "@/src/zero/queries";

const POS_PRODUCTS_PAGE_SIZE = 100;

function normalizeCategory(row: {
  id: string;
  name: string;
  description?: string | null;
}): Category {
  return {
    id: row.id,
    name: row.name,
  };
}

export function usePosSettings() {
  const [organizationRows, status] = useZeroQuery(
    queries.organization.current()
  );
  const error = getZeroQueryError(status);
  const settings = useMemo(() => {
    const organizationSettings = parseOrganizationSettingsMetadata(
      typeof organizationRows[0]?.metadata === "string"
        ? organizationRows[0]?.metadata
        : null
    );
    const paymentMethods = getEnabledPaymentMethods(organizationSettings).map(
      (paymentMethod) => ({
        id: paymentMethod.id,
        label: paymentMethod.label,
        requiresReference: paymentMethod.requiresReference,
      })
    );

    return {
      defaultTerminalName: organizationSettings.pos.defaultTerminalName,
      defaultStartingCash: organizationSettings.pos.defaultStartingCash,
      paymentMethods,
      allowCreditSales: organizationSettings.credit.allowCreditSales,
    };
  }, [organizationRows]);

  return {
    data: settings,
    error,
    isError: Boolean(error),
    isLoading: status.type === "unknown" && organizationRows.length === 0,
    refetch: () => {
      if (status.type === "error") {
        status.retry();
      }
      return Promise.resolve();
    },
  };
}

export function usePosCategories() {
  const [categoryRows, status] = useZeroQuery(queries.products.categories());
  const error = getZeroQueryError(status);
  const categories = useMemo(
    () => categoryRows.map(normalizeCategory),
    [categoryRows]
  );

  return {
    data: categories,
    error,
    isError: Boolean(error),
    isLoading: status.type === "unknown" && categoryRows.length === 0,
    refetch: () => {
      if (status.type === "error") {
        status.retry();
      }
      return Promise.resolve();
    },
  };
}

export function usePosModifierProducts() {
  const [modifierRows, status] = useZeroQuery(queries.products.modifiers());
  const error = getZeroQueryError(status);
  const modifierProducts = useMemo(
    () =>
      modifierRows.map((row) => buildPosProduct(row as PosProductWithCategory)),
    [modifierRows]
  );

  return {
    data: modifierProducts,
    error,
    isError: Boolean(error),
    isLoading: status.type === "unknown" && modifierRows.length === 0,
    refetch: () => {
      if (status.type === "error") {
        status.retry();
      }
      return Promise.resolve();
    },
  };
}

export function usePosProducts(activeCategoryId: string, searchQuery: string) {
  const categoryId = activeCategoryId === "all" ? null : activeCategoryId;
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearch = deferredSearchQuery.trim() || null;
  const filterKey = `${categoryId ?? "all"}:${normalizedSearch ?? ""}`;
  const [pageState, setPageState] = useState({
    filterKey,
    loadedPageCount: 1,
  });
  const loadedPageCount =
    pageState.filterKey === filterKey ? pageState.loadedPageCount : 1;
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);

  const [productRows, status] = useZeroQuery(
    queries.products.posCatalog({
      categoryId,
      searchQuery: normalizedSearch,
      limit: 1000,
    })
  );
  const error = getZeroQueryError(status);

  const sortedProducts = useMemo(() => {
    const products = productRows.map((row) =>
      buildPosProduct(row as PosProductWithCategory)
    );
    return sortPosProducts(products, normalizedSearch);
  }, [normalizedSearch, productRows]);

  const pages = useMemo(
    () =>
      buildPosProductPages(
        sortedProducts,
        loadedPageCount,
        POS_PRODUCTS_PAGE_SIZE
      ),
    [loadedPageCount, sortedProducts]
  );

  const lastPage = pages.at(-1);
  const hasNextPage = lastPage?.hasMore ?? false;

  const hasLoadedRef = useRef(false);
  const staleDataRef = useRef<{ pages: typeof pages }>({ pages: [] });
  const isQueryLoading =
    status.type === "unknown" && productRows.length === 0 && pages.length === 0;

  const nextData = { pages };

  if (!isQueryLoading) {
    staleDataRef.current = nextData;
    hasLoadedRef.current = true;
  }

  const displayData = isQueryLoading ? staleDataRef.current : nextData;

  return {
    data: displayData,
    error,
    isError: Boolean(error),
    isLoading: isQueryLoading && !hasLoadedRef.current,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage: () => {
      if (!hasNextPage || isFetchingNextPage) {
        return Promise.resolve();
      }

      setIsFetchingNextPage(true);
      setPageState({
        filterKey,
        loadedPageCount: loadedPageCount + 1,
      });
      setIsFetchingNextPage(false);
      return Promise.resolve();
    },
    refetch: () => {
      if (status.type === "error") {
        status.retry();
      }
      return Promise.resolve();
    },
  };
}

export function useToggleProductFavoriteMutation() {
  return useZeroMutation(async (input: { productId: string }, zero) => {
    await waitForZeroMutation(
      zero.mutate(mutators.products.toggleFavorite(input))
    );
    return { success: true };
  });
}
