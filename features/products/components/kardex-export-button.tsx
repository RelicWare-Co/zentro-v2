import { Button } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useZero } from "@rocicorp/zero/react";
import { Download } from "lucide-react";
import { useState } from "react";
import type { InventoryMovementsListParams } from "@/features/products/hooks/use-inventory-movements";
import {
  buildInventoryMovementsCsv,
  downloadInventoryMovementsCsv,
  fetchInventoryMovementsForExport,
  type InventoryMovementWithRelations,
} from "@/features/products/inventory-movements.shared";
import { queries } from "@/zero/queries";

export function KardexExportButton({
  listParams,
}: {
  listParams: InventoryMovementsListParams;
}) {
  const zero = useZero();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { rows, truncated } = await fetchInventoryMovementsForExport({
        listParams,
        runQuery: async (args) =>
          (await zero.run(queries.products.movements.list(args), {
            type: "unknown",
          })) as InventoryMovementWithRelations[],
      });

      if (rows.length === 0) {
        notifications.show({
          message: "No hay movimientos para exportar con los filtros actuales.",
        });
        return;
      }

      const csv = buildInventoryMovementsCsv(rows);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadInventoryMovementsCsv(`kardex-${stamp}.csv`, csv);

      if (truncated) {
        notifications.show({
          message:
            "Se exportó el máximo de 10.000 filas. Ajusta el rango de fechas para ver el resto.",
          color: "yellow",
        });
        return;
      }

      notifications.show({
        message: `Exportados ${rows.length} movimientos.`,
        color: "green",
      });
    } catch {
      notifications.show({
        message: "No se pudo exportar el Kardex.",
        color: "red",
      });
    }
    setIsExporting(false);
  };

  return (
    <Button
      color="gray"
      leftSection={<Download className="size-4" />}
      loading={isExporting}
      onClick={() => {
        handleExport().catch(() => undefined);
      }}
      type="button"
      variant="outline"
    >
      Exportar CSV
    </Button>
  );
}
