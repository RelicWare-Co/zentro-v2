import { Button, Drawer, Select, TextInput } from "@mantine/core";
import { type FormEvent, useState } from "react";
import { Link } from "@/components/link";
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
  darkDrawerStyles,
  darkInputStyles,
  darkSelectStyles,
} from "@/lib/mantine-dark";
import {
  formatMoneyInput,
  getErrorMessage,
  parseMoneyInput,
  sanitizeMoneyInput,
} from "@/lib/utils";

function ProductFormSheetContent({
  product,
  categories,
  isPending,
  error,
  onSave,
  onOpenCategoryDialog,
  lowStockThreshold,
  lastCreatedCategoryId,
}: {
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
    <form className="flex h-full flex-col" onSubmit={handleSubmit}>
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <p className="text-sm text-zinc-400">
          Datos de venta, inventario y clasificación.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <ProductsField label="Nombre" required>
            <TextInput
              id="product-form-name"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Ej. Café americano"
              required
              styles={darkInputStyles}
              value={form.name}
            />
          </ProductsField>
          <ProductsField label="Categoría">
            <Select
              data={[
                { value: "none", label: "Sin categoría" },
                ...categories.map((category) => ({
                  value: category.id,
                  label: category.name,
                })),
                { value: "add", label: "Agregar categoría" },
              ]}
              onChange={(value) => {
                if (value === "add") {
                  onOpenCategoryDialog();
                  return;
                }
                setForm((current) => ({
                  ...current,
                  categoryId: value === "none" ? "" : (value ?? ""),
                }));
                setHasExplicitCategorySelection(true);
              }}
              placeholder="Sin categoría"
              styles={darkSelectStyles}
              value={effectiveCategoryId || "none"}
            />
          </ProductsField>
          <ProductsField label="SKU">
            <TextInput
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sku: event.target.value,
                }))
              }
              placeholder="Ej. CAF-001"
              styles={darkInputStyles}
              value={form.sku}
            />
          </ProductsField>
          <ProductsField label="Código de barras">
            <div className="flex gap-2">
              <TextInput
                className="flex-1"
                id="product-form-barcode"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    barcode: event.target.value,
                  }))
                }
                placeholder="Ej. 7701234567890"
                styles={darkInputStyles}
                value={form.barcode}
              />
              <Button
                color="gray"
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
            <TextInput
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
              styles={darkInputStyles}
              type="text"
              value={formatMoneyInput(form.price)}
            />
          </ProductsField>
          <ProductsField label="Costo">
            <TextInput
              id="product-form-cost"
              inputMode="numeric"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  cost: sanitizeMoneyInput(event.target.value),
                }))
              }
              placeholder="0"
              styles={darkInputStyles}
              type="text"
              value={formatMoneyInput(form.cost)}
            />
          </ProductsField>
          <ProductsField label="Impuesto (%)">
            <TextInput
              max={100}
              min={0}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  taxRate: event.target.value,
                }))
              }
              placeholder="0"
              styles={darkInputStyles}
              type="number"
              value={form.taxRate}
            />
          </ProductsField>
          {form.trackInventory ? (
            <>
              <ProductsField label="Stock inicial">
                <TextInput
                  id="product-form-stock"
                  min={0}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      stock: event.target.value,
                    }))
                  }
                  placeholder="0"
                  styles={darkInputStyles}
                  type="number"
                  value={form.stock}
                />
              </ProductsField>
              <ProductsField label="Stock mínimo (alerta)">
                <TextInput
                  min={0}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      minStock: event.target.value,
                    }))
                  }
                  placeholder={`Vacío = ${lowStockThreshold}`}
                  styles={darkInputStyles}
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
                <TextInput
                  min={0}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reorderQuantity: event.target.value,
                    }))
                  }
                  placeholder="Opcional"
                  styles={darkInputStyles}
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

      <div className="shrink-0 border-zinc-800 border-t bg-black/30 p-6">
        <Button c="black" color="voltage.5" loading={isPending} type="submit">
          Guardar producto
        </Button>
      </div>
    </form>
  );
}

export function ProductFormSheet() {
  const { state, actions, meta } = useProductsPage();
  const { mutations } = meta;
  const isPending =
    mutations.createProductMutation.isPending ||
    mutations.updateProductMutation.isPending;

  return (
    <Drawer
      onClose={actions.closeProductSheet}
      opened={state.isProductSheetOpen}
      position="right"
      size={780}
      styles={darkDrawerStyles}
      title={state.editingProduct ? "Editar producto" : "Crear producto"}
    >
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
        onSave={actions.saveProduct}
        product={state.editingProduct}
      />
    </Drawer>
  );
}
