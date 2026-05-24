export function buildListRangeLabel({
  hasMoreResults,
  itemCount,
  pageIndex,
  pageSize,
  totalResults,
}: {
  hasMoreResults: boolean;
  itemCount: number;
  pageIndex: number;
  pageSize: number;
  totalResults: number | null | undefined;
}) {
  if (itemCount === 0) {
    return "0-0";
  }

  const rangeStart = pageIndex * pageSize + 1;
  const rangeEnd = pageIndex * pageSize + itemCount;

  if (totalResults == null) {
    return `${rangeStart}-${rangeEnd}${hasMoreResults ? "+" : ""}`;
  }

  return `${rangeStart}-${rangeEnd} de ${totalResults}`;
}
