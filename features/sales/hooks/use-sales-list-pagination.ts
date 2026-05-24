import { useCallback, useEffect, useState } from "react";
import type { SaleListCursor } from "@/features/sales/sales.shared";

export function useSalesListPagination(filterKey: string) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<(SaleListCursor | null)[]>([
    null,
  ]);
  const listCursor = pageCursors[pageIndex] ?? null;

  const resetPagination = useCallback(() => {
    setPageIndex(0);
    setPageCursors([null]);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: filterKey drives pagination reset
  useEffect(() => {
    resetPagination();
  }, [filterKey, resetPagination]);

  const goToPreviousPage = () => {
    setPageIndex((currentPage) => Math.max(currentPage - 1, 0));
  };

  const goToNextPage = (nextCursor: SaleListCursor) => {
    setPageCursors((currentCursors) => {
      const nextCursors = currentCursors.slice(0, pageIndex + 1);
      nextCursors.push(nextCursor);
      return nextCursors;
    });
    setPageIndex((currentPage) => currentPage + 1);
  };

  return {
    goToNextPage,
    goToPreviousPage,
    listCursor,
    pageIndex,
    resetPagination,
  };
}
