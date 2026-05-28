import { Check, ChevronsUpDown } from "lucide-react";
import { useId, useState } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ProductsField } from "@/features/products/components/products-ui-primitives";
import { useProductsPage } from "@/features/products/products-page-context";
import { cn, getErrorMessage } from "@/lib/utils";

export function InventoryDialog() {
  const { state, actions, meta } = useProductsPage();
  const { mutations } = meta;
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const open = Boolean(state.inventoryProduct);
  const isPending = mutations.registerInventoryMovementMutation.isPending;
  const quantityId = useId();
  const notesId = useId();

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
          <ProductsField label="Tipo">
            <Select
              onValueChange={(value) =>
                actions.setInventoryType(
                  value as "restock" | "waste" | "adjustment"
                )
              }
              value={state.inventoryType}
            >
              <SelectTrigger className="w-full border-zinc-700 bg-black/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
                <SelectItem value="restock">Reposición</SelectItem>
                <SelectItem value="waste">Merma</SelectItem>
                <SelectItem value="adjustment">Ajuste</SelectItem>
              </SelectContent>
            </Select>
          </ProductsField>
          <ProductsField htmlFor={quantityId} label="Cantidad" required>
            <Input
              className="border-zinc-700 bg-black/20"
              id={quantityId}
              onChange={(event) =>
                actions.setInventoryQuantity(event.target.value)
              }
              placeholder="Ej. 10"
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
              Number(state.inventoryQuantity) === 0
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
