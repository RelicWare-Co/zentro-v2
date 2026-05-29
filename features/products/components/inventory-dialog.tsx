import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ProductsField } from "@/features/products/components/products-ui-primitives";
import type { InventoryMovementType } from "@/features/products/products-page-context";
import { useProductsPage } from "@/features/products/products-page-context";
import { cn, getErrorMessage } from "@/lib/utils";

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

export function InventoryDialog() {
  const { state, actions, meta } = useProductsPage();
  const { mutations } = meta;
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const open = Boolean(state.inventoryProduct);
  const isPending = mutations.registerInventoryMovementMutation.isPending;
  const quantityId = useId();
  const notesId = useId();
  const restockAddId = useId();
  const restockSetId = useId();

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
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          actions.closeInventoryDialog();
        }
      }}
      open={open}
    >
      <DialogContent className="border-zinc-800 bg-[var(--color-carbon)] text-white sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Movimiento de stock</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <ProductsField label="Producto">
            <Popover
              onOpenChange={setProductPickerOpen}
              open={productPickerOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  aria-controls="inventory-product-picker-list"
                  aria-expanded={productPickerOpen}
                  className="w-full justify-between border-zinc-700 bg-black/20 text-white hover:bg-white/5"
                  role="combobox"
                  type="button"
                  variant="outline"
                >
                  <span className="truncate">
                    {state.inventoryProduct
                      ? `${state.inventoryProduct.name} (${state.inventoryProduct.stock})`
                      : "Seleccionar producto..."}
                  </span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 text-zinc-500" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(360px,calc(100vw-2rem))] border-zinc-800 bg-[var(--color-carbon)] p-0 text-white">
                <Command className="bg-transparent">
                  <CommandInput
                    className="text-white placeholder:text-zinc-500"
                    placeholder="Buscar producto..."
                  />
                  <CommandList
                    className="p-1.5"
                    id="inventory-product-picker-list"
                  >
                    <CommandEmpty className="text-zinc-400">
                      No se encontraron productos.
                    </CommandEmpty>
                    {state.productsWithInventory.map((item) => (
                      <CommandItem
                        className="gap-3 rounded-lg py-2 text-white"
                        key={item.id}
                        onSelect={() => {
                          actions.setInventoryProduct(item);
                          setProductPickerOpen(false);
                        }}
                        value={`${item.name} ${item.id}`}
                      >
                        <span className="truncate">
                          {item.name} ({item.stock})
                        </span>
                        <Check
                          className={cn(
                            "ml-auto size-4 shrink-0",
                            state.inventoryProduct?.id === item.id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </ProductsField>
          <ProductsField label="Tipo de movimiento">
            <Select
              onValueChange={(value) => {
                actions.setInventoryType(value as InventoryMovementType);
                if (value === "restock") {
                  actions.setInventoryRestockMode("add_to_stock");
                }
              }}
              value={state.inventoryType}
            >
              <SelectTrigger className="w-full border-zinc-700 bg-black/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
                {MOVEMENT_GROUP_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-zinc-500">
              {
                MOVEMENT_GROUP_OPTIONS.find(
                  (option) => option.value === state.inventoryType
                )?.description
              }
            </p>
          </ProductsField>
          {state.inventoryType === "restock" ? (
            <div className="space-y-2 rounded-lg border border-zinc-800 bg-black/20 p-3">
              <p className="font-medium text-sm text-zinc-200">
                Modo de reposición
              </p>
              <RadioGroup
                className="gap-3"
                onValueChange={(value) =>
                  actions.setInventoryRestockMode(
                    value as "add_to_stock" | "set_as_total"
                  )
                }
                value={state.inventoryRestockMode}
              >
                <div className="flex items-start gap-2">
                  <RadioGroupItem id={restockAddId} value="add_to_stock" />
                  <Label
                    className="text-sm text-zinc-300"
                    htmlFor={restockAddId}
                  >
                    Sumar al stock actual
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem id={restockSetId} value="set_as_total" />
                  <Label
                    className="text-sm text-zinc-300"
                    htmlFor={restockSetId}
                  >
                    Fijar stock total
                  </Label>
                </div>
              </RadioGroup>
            </div>
          ) : null}
          <ProductsField
            htmlFor={quantityId}
            label={
              state.inventoryType === "waste"
                ? "Cantidad a descontar"
                : "Cantidad"
            }
            required
          >
            <Input
              className="border-zinc-700 bg-black/20"
              id={quantityId}
              min={1}
              onChange={(event) =>
                actions.setInventoryQuantity(event.target.value)
              }
              placeholder={
                state.inventoryType === "restock"
                  ? "Ej. cantidad sugerida"
                  : "Ej. 10"
              }
              required
              type="number"
              value={state.inventoryQuantity}
            />
          </ProductsField>
          <ProductsField htmlFor={notesId} label="Notas">
            <Textarea
              className="min-h-[80px] border-zinc-700 bg-black/20"
              id={notesId}
              onChange={(event) =>
                actions.setInventoryNotes(event.target.value)
              }
              placeholder="Motivo o referencia del movimiento…"
              value={state.inventoryNotes}
            />
          </ProductsField>
          {mutations.registerInventoryMovementMutation.error ? (
            <p className="text-red-400 text-sm">
              {getErrorMessage(
                mutations.registerInventoryMovementMutation.error,
                "No se pudo registrar el movimiento."
              )}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
            disabled={
              isPending ||
              !state.inventoryProduct ||
              !Number.isFinite(Number(state.inventoryQuantity)) ||
              Number(state.inventoryQuantity) === 0 ||
              (state.inventoryType !== "adjustment" &&
                Number(state.inventoryQuantity) < 0)
            }
            onClick={() => {
              actions.saveInventoryMovement().catch(() => undefined);
            }}
            type="button"
          >
            {isPending ? "Guardando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
