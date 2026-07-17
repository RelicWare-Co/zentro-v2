const SALE_STATUS_LABELS: Record<string, string> = {
  completed: "Pagada",
  credit: "Crédito pendiente",
  cancelled: "Cancelada",
};

const SALE_FILTER_STATUS_LABELS: Record<string, string> = {
  active: "Ventas válidas",
  completed: "Pagadas",
  credit: "Crédito pendiente",
  cancelled: "Canceladas",
};

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  expense: "Gasto operativo",
  payout: "Pago a proveedor",
  inflow: "Ingreso manual",
};

export function formatReportSaleStatus(status: string): string {
  return SALE_STATUS_LABELS[status] ?? status;
}

export function formatReportSaleFilterStatus(status: string): string {
  return SALE_FILTER_STATUS_LABELS[status] ?? status;
}

export function formatReportMovementType(type: string): string {
  return MOVEMENT_TYPE_LABELS[type] ?? type;
}
