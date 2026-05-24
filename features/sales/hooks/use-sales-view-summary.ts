import { useMemo } from "react";

export function useSalesViewSummary(
  isTodayView: boolean,
  todayLabel: string,
  activeFilterCount: number
) {
  return useMemo(() => {
    if (isTodayView) {
      return {
        kicker: `Solo ${todayLabel}`,
        title: "Ventas de hoy",
        description:
          "Consulta lo que pasó hoy sin mezclar operaciones anteriores.",
        resultsTitle: "Ventas del dia",
        resultsDescription: "Registros creados durante el dia actual",
        revenueTitle: "Ingreso del dia",
        revenueDescription: "Total facturado hoy",
        pendingTitle: "Saldo pendiente hoy",
        pendingDescription: "Pendientes abiertos del dia actual",
        listTitle: "Ventas de hoy",
        listDescription:
          "Vista operativa del día con acceso rápido al detalle de cada venta.",
        emptyTitle: "No hay ventas registradas hoy.",
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
  }, [isTodayView, todayLabel, activeFilterCount]);
}
