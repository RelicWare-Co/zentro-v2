import { useEffect, useState } from "react";

export function useCursorListPagination<TCursor>(filterKey: string) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<(TCursor | null)[]>([null]);
  const listCursor = pageCursors[pageIndex] ?? null;

  const resetPagination = () => {
    setPageIndex(0);
    setPageCursors([null]);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: filterKey drives pagination reset
  useEffect(() => {
    resetPagination();
  }, [filterKey]);

  const goToPreviousPage = () => {
    setPageIndex((currentPage) => Math.max(currentPage - 1, 0));
  };

  const goToNextPage = (nextCursor: TCursor) => {
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
