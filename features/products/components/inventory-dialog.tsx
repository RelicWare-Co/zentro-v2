import {
  Button,
  Modal,
  Radio,
  Select,
  Stack,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useEffect } from "react";
import type { InventoryMovementType } from "@/features/products/products-page-context";
import { useProductsPage } from "@/features/products/products-page-context";
import {
  darkInputStyles,
  darkModalStyles,
  darkSelectStyles,
} from "@/lib/mantine-dark";
import { getErrorMessage } from "@/lib/utils";

const MOVEMENT_GROUP_OPTIONS = [
  {
    value: "restock",
    label: "Entrada (reposición)",
    description: "Suma unidades al inventario.",
  },
  {
    value: "waste",
    label: "Salida (merma)",
    description: "Descuenta unidades por pérdida o daño.",
  },
  {
    value: "adjustment",
    label: "Ajuste",
    description: "Corrige el stock con cantidad positiva o negativa.",
  },
] as const;

const radioLabelStyles = { label: { color: "inherit" } } as const;

export function InventoryDialog() {
  const { state, actions, meta } = useProductsPage();
  const { mutations } = meta;
  const open = Boolean(state.inventoryProduct);
  const isPending = mutations.registerInventoryMovementMutation.isPending;

  useEffect(() => {
    if (!state.inventoryProduct || state.inventoryType !== "restock") {
      return;
    }
    if (state.inventoryQuantity.trim()) {
      return;
    }
    const suggested = state.inventoryProduct.reorderQuantity;
    if (typeof suggested === "number" && suggested > 0) {
      actions.setInventoryQuantity(String(suggested));
    }
  }, [
    actions,
    state.inventoryProduct,
    state.inventoryQuantity,
    state.inventoryType,
  ]);

  return (
    <Modal
      centered
      onClose={actions.closeInventoryDialog}
      opened={open}
      size="lg"
      styles={darkModalStyles}
      title="Movimiento de stock"
    >
      <div className="space-y-4">
        <Select
          data={state.productsWithInventory.map((item) => ({
            value: item.id,
            label: `${item.name} (${item.stock})`,
          }))}
          label="Producto"
          nothingFoundMessage="No se encontraron productos."
          onChange={(value) => {
            const item = state.productsWithInventory.find(
              (candidate) => candidate.id === value
            );
            if (item) {
              actions.setInventoryProduct(item);
            }
          }}
          placeholder="Seleccionar producto..."
          searchable
          styles={darkSelectStyles}
          value={state.inventoryProduct?.id ?? null}
        />
        <div>
          <Select
            data={MOVEMENT_GROUP_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            label="Tipo de movimiento"
            onChange={(value) => {
              if (!value) {
                return;
              }
              actions.setInventoryType(value as InventoryMovementType);
              if (value === "restock") {
                actions.setInventoryRestockMode("add_to_stock");
              }
            }}
            styles={darkSelectStyles}
            value={state.inventoryType}
          />
          <p className="mt-1 text-xs text-zinc-500">
            {
              MOVEMENT_GROUP_OPTIONS.find(
                (option) => option.value === state.inventoryType
              )?.description
            }
          </p>
        </div>
        {state.inventoryType === "restock" ? (
          <div className="space-y-2 rounded-lg border border-zinc-800 bg-black/20 p-3">
            <p className="font-medium text-sm text-zinc-200">
              Modo de reposición
            </p>
            <Radio.Group
              onChange={(value) =>
                actions.setInventoryRestockMode(
                  value as "add_to_stock" | "set_as_total"
                )
              }
              value={state.inventoryRestockMode}
            >
              <Stack gap="xs">
                <Radio
                  color="voltage.5"
                  label="Sumar al stock actual"
                  styles={radioLabelStyles}
                  value="add_to_stock"
                />
                <Radio
                  color="voltage.5"
                  label="Fijar stock total"
                  styles={radioLabelStyles}
                  value="set_as_total"
                />
              </Stack>
            </Radio.Group>
          </div>
        ) : null}
        <TextInput
          label={
            state.inventoryType === "waste"
              ? "Cantidad a descontar"
              : "Cantidad"
          }
          min={1}
          onChange={(event) => actions.setInventoryQuantity(event.target.value)}
          placeholder={
            state.inventoryType === "restock"
              ? "Ej. cantidad sugerida"
              : "Ej. 10"
          }
          required
          styles={darkInputStyles}
          type="number"
          value={state.inventoryQuantity}
          withAsterisk
        />
        <Textarea
          label="Notas"
          minRows={3}
          onChange={(event) => actions.setInventoryNotes(event.target.value)}
          placeholder="Motivo o referencia del movimiento…"
          styles={darkInputStyles}
          value={state.inventoryNotes}
        />
        {mutations.registerInventoryMovementMutation.error ? (
          <p className="text-red-400 text-sm">
            {getErrorMessage(
              mutations.registerInventoryMovementMutation.error,
              "No se pudo registrar el movimiento."
            )}
          </p>
        ) : null}
      </div>
      <div className="mt-6 flex justify-end">
        <Button
          c="black"
          color="voltage.5"
          disabled={
            !(
              state.inventoryProduct &&
              Number.isFinite(Number(state.inventoryQuantity))
            ) ||
            Number(state.inventoryQuantity) === 0 ||
            (state.inventoryType !== "adjustment" &&
              Number(state.inventoryQuantity) < 0)
          }
          loading={isPending}
          onClick={() => {
            actions.saveInventoryMovement().catch(() => undefined);
          }}
          type="button"
        >
          Registrar
        </Button>
      </div>
    </Modal>
  );
}
