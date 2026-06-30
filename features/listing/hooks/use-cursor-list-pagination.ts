import { useRef, useState } from "react";

export function useCursorListPagination<TCursor>(filterKey: string) {
  const prevFilterKeyRef = useRef(filterKey);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<(TCursor | null)[]>([null]);
  const listCursor = pageCursors[pageIndex] ?? null;

  // Reset pagination inline when filterKey changes to avoid stale UI
  if (prevFilterKeyRef.current !== filterKey) {
    prevFilterKeyRef.current = filterKey;
    setPageIndex(0);
    setPageCursors([null]);
  }

  const resetPagination = () => {
    setPageIndex(0);
    setPageCursors([null]);
  };

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
