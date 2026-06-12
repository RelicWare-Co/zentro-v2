import type { PosTableOrderItemStatus } from "@/features/pos/hooks/use-pos-table-order";
import { getOrderItemStatusLabel } from "@/features/restaurants/restaurants-ui.shared";

const itemStatusBadgeClassName: Record<PosTableOrderItemStatus, string> = {
  draft: "bg-amber-400/15 text-amber-200",
  sent: "bg-orange-400/15 text-orange-200",
  ready: "bg-sky-400/15 text-sky-200",
  served: "bg-emerald-400/15 text-emerald-200",
};

export function buildTableItemStatusBadge(
  status: PosTableOrderItemStatus | undefined
) {
  if (!status) {
    return null;
  }
  return {
    label: getOrderItemStatusLabel(status),
    className: itemStatusBadgeClassName[status],
  };
}
