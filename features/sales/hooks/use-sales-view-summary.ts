import { useMemo } from "react";
import type { SalesWindowKind } from "@/features/shifts/shift-types.shared";

function getSalesWindowCopy(kind: SalesWindowKind) {
  switch (kind) {
    case "closed":
      return {
        kicker: "Ultimo turno",
        windowLabel: "ultimo turno",
        windowTitle: "el ultimo turno",
      };
    case "open":
      return {
        kicker: "Turno actual",
        windowLabel: "turno actual",
        windowTitle: "el turno actual",
      };
    default:
      return {
        kicker: "Sin turno",
        windowLabel: "turno",
        windowTitle: "un turno",
      };
  }
}

export function useSalesViewSummary(
  isTodayView: boolean,
  salesWindowKind: SalesWindowKind,
  activeFilterCount: number
) {
  return useMemo(() => {
    if (isTodayView) {
      const { kicker, windowLabel, windowTitle } =
        getSalesWindowCopy(salesWindowKind);

      return {
        kicker,
        title: `Ventas de ${windowLabel}`,
        description: `Consulta las operaciones de ${windowTitle} sin limitarte al dia calendario.`,
        resultsTitle: `Ventas del ${windowLabel}`,
        resultsDescription: `Registros asociados a ${windowTitle}`,
        revenueTitle: `Ingreso del ${windowLabel}`,
        revenueDescription: `Total facturado en ${windowTitle}`,
        pendingTitle: `Saldo pendiente del ${windowLabel}`,
        pendingDescription: `Pendientes abiertos de ${windowTitle}`,
        listTitle: `Ventas de ${windowLabel}`,
        listDescription:
          "Vista operativa del turno con acceso rápido al detalle de cada venta.",
        emptyTitle: `No hay ventas registradas en ${windowTitle}.`,
      };
    }
    return {
      kicker: "Consulta completa",
      title: "Historial de ventas",
      description:
        "Consulta ventas pasadas con filtros por fecha, estado y medio de pago.",
      resultsTitle: "Ventas cargadas",
      resultsDescription:
        activeFilterCount > 0
          ? "Resultados del filtro actual"
          : "Ultimos registros disponibles en pantalla",
      revenueTitle: "Monto acumulado",
      revenueDescription: "Suma de las ventas listadas",
      pendingTitle: "Saldo pendiente",
      pendingDescription: "Principalmente ventas a credito",
      listTitle: "Historial de ventas",
      listDescription:
        "Usa esta vista para revisar ventas anteriores, pagos y saldos.",
      emptyTitle: "No se han registrado ventas todavia.",
    };
  }, [isTodayView, salesWindowKind, activeFilterCount]);
}
