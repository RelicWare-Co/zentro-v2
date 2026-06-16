import { Button } from "@mantine/core";
import { useZero } from "@rocicorp/zero/react";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
        toast.message(
          "No hay movimientos para exportar con los filtros actuales."
        );
        return;
      }

      const csv = buildInventoryMovementsCsv(rows);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadInventoryMovementsCsv(`kardex-${stamp}.csv`, csv);

      if (truncated) {
        toast.warning(
          "Se exportó el máximo de 10.000 filas. Ajusta el rango de fechas para ver el resto."
        );
        return;
      }

      toast.success(`Exportados ${rows.length} movimientos.`);
    } catch {
      toast.error("No se pudo exportar el Kardex.");
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
