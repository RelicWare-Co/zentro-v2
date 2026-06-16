import { type FormEvent, useState } from "react";
import { Link } from "@/components/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { generateEan13Barcode } from "@/features/products/barcode.shared";
import {
  ProductsField,
  ProductsToggleLine,
} from "@/features/products/components/products-ui-primitives";
import {
  getProductFormInitialValue,
  parseOptionalStockField,
} from "@/features/products/products-form.shared";
import { useProductsPage } from "@/features/products/products-page-context";
import {
  formatMoneyInput,
  getErrorMessage,
  parseMoneyInput,
  sanitizeMoneyInput,
} from "@/lib/utils";

function ProductFormSheetContent({
  open,
  onOpenChange,
  product,
  categories,
  isPending,
  error,
  onSave,
  onOpenCategoryDialog,
  lowStockThreshold,
  lastCreatedCategoryId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ReturnType<typeof useProductsPage>["state"]["editingProduct"];
  categories: ReturnType<typeof useProductsPage>["state"]["categories"];
  isPending: boolean;
  error: unknown;
  onSave: ReturnType<typeof useProductsPage>["actions"]["saveProduct"];
  onOpenCategoryDialog: () => void;
  lowStockThreshold: number;
  lastCreatedCategoryId: string | null;
}) {
  const [form, setForm] = useState(() => getProductFormInitialValue(product));
  const [hasExplicitCategorySelection, setHasExplicitCategorySelection] =
    useState(false);
  const effectiveCategoryId =
    form.categoryId ||
    (hasExplicitCategorySelection ? "" : (lastCreatedCategoryId ?? ""));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave({
      ...(product ? { id: product.id } : {}),
      name: form.name,
      categoryId: effectiveCategoryId || null,
      sku: form.sku || null,
      barcode: form.barcode || null,
      price: parseMoneyInput(form.price),
      cost: parseMoneyInput(form.cost),
      taxRate: Number(form.taxRate) || 0,
      stock: Number(form.stock) || 0,
      minStock: parseOptionalStockField(form.minStock),
      reorderQuantity: parseOptionalStockField(form.reorderQuantity),
      trackInventory: form.trackInventory,
      isModifier: form.isModifier,
    });
  };

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="!w-full !max-w-full sm:!w-[780px] overflow-hidden border-zinc-800 border-l bg-[var(--color-carbon)] p-0 text-white">
        <form className="flex h-full flex-col" onSubmit={handleSubmit}>
          <SheetHeader className="shrink-0 border-zinc-800 border-b p-6">
            <SheetTitle className="font-bold text-2xl">
              {product ? "Editar producto" : "Crear producto"}
            </SheetTitle>
            <SheetDescription className="text-zinc-400">
              Datos de venta, inventario y clasificación.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <ProductsField label="Nombre" required>
                <Input
                  className="border-zinc-700 bg-black/20"
                  id="product-form-name"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Ej. Café americano"
                  required
                  value={form.name}
                />
              </ProductsField>
              <ProductsField label="Categoría">
                <Select
                  onValueChange={(value) => {
                    if (value === "add") {
                      onOpenCategoryDialog();
                      return;
                    }
                    setForm((current) => ({
                      ...current,
                      categoryId: value === "none" ? "" : value,
                    }));
                    setHasExplicitCategorySelection(true);
                  }}
                  value={effectiveCategoryId || "none"}
                >
                  <SelectTrigger className="w-full border-zinc-700 bg-black/20 text-white">
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
                    <SelectItem value="none">Sin categoría</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="add">Agregar categoría</SelectItem>
                  </SelectContent>
                </Select>
              </ProductsField>
              <ProductsField label="SKU">
                <Input
                  className="border-zinc-700 bg-black/20"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sku: event.target.value,
                    }))
                  }
                  placeholder="Ej. CAF-001"
                  value={form.sku}
                />
              </ProductsField>
              <ProductsField label="Código de barras">
                <div className="flex gap-2">
                  <Input
                    className="border-zinc-700 bg-black/20"
                    id="product-form-barcode"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        barcode: event.target.value,
                      }))
                    }
                    placeholder="Ej. 7701234567890"
                    value={form.barcode}
                  />
                  <Button
                    className="shrink-0 border-zinc-700 bg-black/20 text-zinc-200 hover:bg-white/5"
                    disabled={Boolean(form.barcode.trim())}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        barcode: generateEan13Barcode(),
                      }))
                    }
                    type="button"
                    variant="outline"
                  >
                    Generar
                  </Button>
                </div>
              </ProductsField>
              <ProductsField label="Precio unitario" required>
                <Input
                  className="border-zinc-700 bg-black/20"
                  id="product-form-price"
                  inputMode="numeric"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      price: sanitizeMoneyInput(event.target.value),
                    }))
                  }
                  placeholder="0"
                  required
                  type="text"
                  value={formatMoneyInput(form.price)}
                />
              </ProductsField>
              <ProductsField label="Costo">
                <Input
                  className="border-zinc-700 bg-black/20"
                  id="product-form-cost"
                  inputMode="numeric"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      cost: sanitizeMoneyInput(event.target.value),
                    }))
                  }
                  placeholder="0"
                  type="text"
                  value={formatMoneyInput(form.cost)}
                />
              </ProductsField>
              <ProductsField label="Impuesto (%)">
                <Input
                  className="border-zinc-700 bg-black/20"
                  max={100}
                  min={0}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      taxRate: event.target.value,
                    }))
                  }
                  placeholder="0"
                  type="number"
                  value={form.taxRate}
                />
              </ProductsField>
              {form.trackInventory ? (
                <>
                  <ProductsField label="Stock inicial">
                    <Input
                      className="border-zinc-700 bg-black/20"
                      id="product-form-stock"
                      min={0}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          stock: event.target.value,
                        }))
                      }
                      placeholder="0"
                      type="number"
                      value={form.stock}
                    />
                  </ProductsField>
                  <ProductsField label="Stock mínimo (alerta)">
                    <Input
                      className="border-zinc-700 bg-black/20"
                      min={0}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          minStock: event.target.value,
                        }))
                      }
                      placeholder={`Vacío = ${lowStockThreshold}`}
                      type="number"
                      value={form.minStock}
                    />
                    <p className="mt-1 text-xs text-zinc-500">
                      Vacío usa el umbral global ({lowStockThreshold}).{" "}
                      <Link
                        className="text-[var(--color-voltage)] hover:underline"
                        href="/settings"
                      >
                        Editar en configuración
                      </Link>
                    </p>
                  </ProductsField>
                  <ProductsField label="Cantidad sugerida de reposición">
                    <Input
                      className="border-zinc-700 bg-black/20"
                      min={0}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          reorderQuantity: event.target.value,
                        }))
                      }
                      placeholder="Opcional"
                      type="number"
                      value={form.reorderQuantity}
                    />
                  </ProductsField>
                </>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <ProductsToggleLine
                checked={form.trackInventory}
                description="Actualiza stock y movimientos."
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    trackInventory: checked,
                  }))
                }
                title="Controlar inventario"
              />
              <ProductsToggleLine
                checked={form.isModifier}
                description="Se usa como adicional en POS."
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    isModifier: checked,
                  }))
                }
                title="Es modificador"
              />
            </div>

            {error ? (
              <p className="rounded-md border border-red-400/20 bg-red-400/10 p-3 font-medium text-red-300 text-sm">
                {getErrorMessage(error, "No se pudo guardar el producto.")}
              </p>
            ) : null}
          </div>

          <SheetFooter className="shrink-0 border-zinc-800 border-t bg-black/30 p-6">
            <Button
              className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
              disabled={isPending}
              type="submit"
            >
              {isPending ? "Guardando..." : "Guardar producto"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function ProductFormSheet() {
  const { state, actions, meta } = useProductsPage();
  const { mutations } = meta;
  const isPending =
    mutations.createProductMutation.isPending ||
    mutations.updateProductMutation.isPending;

  return (
    <ProductFormSheetContent
      categories={state.categories}
      error={meta.productFormError}
      isPending={isPending}
      key={
        state.isProductSheetOpen
          ? (state.editingProduct?.id ?? "new")
          : "closed"
      }
      lastCreatedCategoryId={state.lastCreatedCategoryId}
      lowStockThreshold={state.lowStockThreshold}
      onOpenCategoryDialog={actions.openCreateCategory}
      onOpenChange={(open) => {
        if (open) {
          return;
        }
        actions.closeProductSheet();
      }}
      onSave={actions.saveProduct}
      open={state.isProductSheetOpen}
      product={state.editingProduct}
    />
  );
}
