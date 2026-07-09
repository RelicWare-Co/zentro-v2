import { ActionIcon, Button, Drawer, Select, TextInput } from "@mantine/core";
import { Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "@/components/link";
import { generateEan13Barcode } from "@/features/products/barcode.shared";
import {
  ProductFormCollapse,
  ProductsField,
  ProductsToggleLine,
} from "@/features/products/components/products-ui-primitives";
import { useIngredients } from "@/features/products/hooks/use-products";
import {
  getProductFormInitialValue,
  type ProductFormIngredientEntry,
  parseOptionalStockField,
} from "@/features/products/products-form.shared";
import { useProductsPage } from "@/features/products/products-page-context";
import {
  normalizeNumber,
  toNonNegativeInteger,
} from "@/lib/domain-values.shared";
import {
  formatMoneyInput,
  getErrorMessage,
  parseMoneyInput,
  sanitizeMoneyInput,
} from "@/lib/utils";

function ProductFormSheetContent({
  product,
  categories,
  enabledPaymentMethods,
  isPending,
  error,
  onSave,
  onOpenCategoryDialog,
  lowStockThreshold,
  lastCreatedCategoryId,
}: {
  product: ReturnType<typeof useProductsPage>["state"]["editingProduct"];
  categories: ReturnType<typeof useProductsPage>["state"]["categories"];
  enabledPaymentMethods: Array<{ id: string; label: string }>;
  isPending: boolean;
  error: unknown;
  onSave: ReturnType<typeof useProductsPage>["actions"]["saveProduct"];
  onOpenCategoryDialog: () => void;
  lowStockThreshold: number;
  lastCreatedCategoryId: string | null;
}) {
  const { state, actions } = useProductsPage();
  const { ingredients } = useIngredients();
  const [form, setForm] = useState(() => getProductFormInitialValue(product));
  const [hasExplicitCategorySelection, setHasExplicitCategorySelection] =
    useState(false);
  const effectiveCategoryId =
    form.categoryId ||
    (hasExplicitCategorySelection ? "" : (lastCreatedCategoryId ?? ""));

  const editingProductIngredients = state.editingProductIngredients;
  useEffect(() => {
    if (!product || editingProductIngredients.length === 0) {
      return;
    }
    setForm((current) => {
      if (current.ingredients.length > 0) {
        return current;
      }
      return {
        ...current,
        ingredients: editingProductIngredients.map((entry) => ({
          ingredientId: entry.ingredientId,
          quantity: String(entry.quantity),
        })),
      };
    });
  }, [editingProductIngredients, product]);

  const ingredientOptions = useMemo(
    () =>
      ingredients.map((ingredient) => ({
        value: ingredient.id,
        label: ingredient.name,
      })),
    [ingredients]
  );

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: pure payload builder with conditional field overrides
  const buildSaveProductPayload = () => {
    const isPassthrough = form.accountingTreatment === "passthrough";
    const isIngredient = form.isIngredient;
    const effectiveTreatment = isIngredient
      ? ("revenue" as const)
      : (form.accountingTreatment as "revenue" | "passthrough");
    return {
      ...(product ? { id: product.id } : {}),
      name: form.name,
      categoryId: effectiveCategoryId || null,
      sku: form.sku || null,
      barcode: form.barcode || null,
      price: isIngredient ? 0 : parseMoneyInput(form.price),
      cost: parseMoneyInput(form.cost),
      taxRate: toNonNegativeInteger(normalizeNumber(form.taxRate), "taxRate"),
      ...(product
        ? {}
        : {
            stock: toNonNegativeInteger(normalizeNumber(form.stock), "stock"),
          }),
      minStock: parseOptionalStockField(form.minStock),
      reorderQuantity: parseOptionalStockField(form.reorderQuantity),
      trackInventory: isPassthrough ? false : form.trackInventory,
      isModifier: isPassthrough || isIngredient ? false : form.isModifier,
      accountingTreatment: effectiveTreatment,
      autoPayoutEnabled:
        isPassthrough && !isIngredient ? form.autoPayoutEnabled : false,
      autoPayoutPaymentMethod: isPassthrough
        ? form.autoPayoutPaymentMethod
        : "cash",
      isIngredient,
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = buildSaveProductPayload();
    await onSave(payload);
    await saveRecipeIfApplicable(product, payload.isIngredient);
  };

  const saveRecipeIfApplicable = async (
    product: ReturnType<typeof useProductsPage>["state"]["editingProduct"],
    isIngredient: boolean
  ) => {
    if (!product || isIngredient) {
      return;
    }
    const validIngredients = form.ingredients.filter(
      (entry) => entry.ingredientId && Number(entry.quantity) > 0
    );
    await actions.saveProductIngredients({
      productId: product.id,
      ingredients: validIngredients.map((entry) => ({
        ingredientId: entry.ingredientId,
        quantity: Number(entry.quantity),
      })),
    });
  };

  const addIngredientEntry = () => {
    setForm((current) => ({
      ...current,
      ingredients: [
        ...current.ingredients,
        { ingredientId: "", quantity: "1" },
      ],
    }));
  };

  const updateIngredientEntry = (
    index: number,
    patch: Partial<ProductFormIngredientEntry>
  ) => {
    setForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry
      ),
    }));
  };

  const removeIngredientEntry = (index: number) => {
    setForm((current) => ({
      ...current,
      ingredients: current.ingredients.filter(
        (_, entryIndex) => entryIndex !== index
      ),
    }));
  };

  return (
    <form className="flex h-full flex-col" onSubmit={handleSubmit}>
      <div className="flex-1 overflow-y-auto p-6">
        <p className="text-sm text-zinc-400">
          Datos de venta, inventario y clasificación.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <ProductsField label="Tipo de producto">
            <Select
              data={[
                { value: "revenue", label: "Contable" },
                { value: "passthrough", label: "No contable" },
              ]}
              disabled={form.isIngredient}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  accountingTreatment: value ?? "revenue",
                  ...(value === "passthrough"
                    ? {
                        trackInventory: false,
                        isModifier: false,
                        taxRate: "0",
                      }
                    : {}),
                }))
              }
              value={form.isIngredient ? "revenue" : form.accountingTreatment}
            />
          </ProductsField>
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
          {form.isIngredient ? null : (
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
                type="text"
                value={formatMoneyInput(form.price)}
              />
            </ProductsField>
          )}
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
              type="text"
              value={formatMoneyInput(form.cost)}
            />
          </ProductsField>
          <ProductsField
            label="Impuesto (%)"
            required={form.accountingTreatment !== "passthrough"}
          >
            <TextInput
              disabled={form.accountingTreatment === "passthrough"}
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
        </div>

        <ProductFormCollapse visible={form.trackInventory}>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {!product && (
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
                  type="number"
                  value={form.stock}
                />
              </ProductsField>
            )}
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
                type="number"
                value={form.reorderQuantity}
              />
            </ProductsField>
          </div>
        </ProductFormCollapse>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <ProductsToggleLine
            checked={form.trackInventory}
            description="Actualiza stock y movimientos."
            disabled={form.accountingTreatment === "passthrough"}
            onCheckedChange={(checked) =>
              setForm((current) => ({
                ...current,
                trackInventory: checked,
              }))
            }
            title="Controlar inventario"
          />
          {form.isIngredient ? null : (
            <ProductsToggleLine
              checked={form.isModifier}
              description="Se usa como adicional en POS."
              disabled={form.accountingTreatment === "passthrough"}
              onCheckedChange={(checked) =>
                setForm((current) => ({
                  ...current,
                  isModifier: checked,
                }))
              }
              title="Es modificador"
            />
          )}
          <ProductsToggleLine
            checked={form.isIngredient}
            description="Insumo consumido por receta. No aparece en POS."
            onCheckedChange={(checked) =>
              setForm((current) => ({
                ...current,
                isIngredient: checked,
                ...(checked
                  ? {
                      price: "0",
                      isModifier: false,
                      accountingTreatment: "revenue",
                      autoPayoutEnabled: false,
                    }
                  : {}),
              }))
            }
            title="Es insumo"
          />
        </div>

        <ProductFormCollapse
          visible={
            form.accountingTreatment === "passthrough" && !form.isIngredient
          }
        >
          <div className="mt-6">
            <ProductsToggleLine
              checked={form.autoPayoutEnabled}
              description="Crea una salida de caja automática al vender este producto."
              onCheckedChange={(checked) =>
                setForm((current) => ({
                  ...current,
                  autoPayoutEnabled: checked,
                }))
              }
              title="Autosalida de caja"
            />
            <ProductFormCollapse visible={form.autoPayoutEnabled}>
              <div className="mt-3">
                <ProductsField label="Método de autosalida">
                  <Select
                    data={enabledPaymentMethods.map((method) => ({
                      value: method.id,
                      label: method.label,
                    }))}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        autoPayoutPaymentMethod: value ?? "cash",
                      }))
                    }
                    value={form.autoPayoutPaymentMethod}
                  />
                </ProductsField>
              </div>
            </ProductFormCollapse>
            <p className="mt-3 text-xs text-zinc-500">
              Los productos no contables se facturan y cobran normalmente, pero
              se excluyen de ingresos y reportes contables.
            </p>
          </div>
        </ProductFormCollapse>

        {form.isIngredient ? null : (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-white">
                  Receta (ingredientes)
                </p>
                <p className="text-xs text-zinc-500">
                  Ingredientes consumidos automáticamente al vender este
                  producto.
                </p>
              </div>
              <Button
                color="gray"
                onClick={addIngredientEntry}
                size="xs"
                type="button"
                variant="outline"
              >
                Agregar ingrediente
              </Button>
            </div>
            {form.ingredients.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">
                Sin ingredientes. Este producto no consume insumos al venderse.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {form.ingredients.map((entry, index) => (
                  <div
                    className="flex items-center gap-2"
                    // biome-ignore lint/suspicious/noArrayIndexKey: index combined with ingredientId for stable keys when adding new entries
                    key={`ingredient-${entry.ingredientId || "new"}-${index}`}
                  >
                    <Select
                      className="flex-1"
                      data={ingredientOptions}
                      onChange={(value) =>
                        updateIngredientEntry(index, {
                          ingredientId: value ?? "",
                        })
                      }
                      placeholder="Seleccionar ingrediente"
                      searchable
                      value={entry.ingredientId}
                    />
                    <TextInput
                      className="w-24"
                      min={1}
                      onChange={(event) =>
                        updateIngredientEntry(index, {
                          quantity: event.target.value,
                        })
                      }
                      placeholder="Cant."
                      type="number"
                      value={entry.quantity}
                    />
                    <ActionIcon
                      aria-label="Eliminar ingrediente"
                      color="red"
                      onClick={() => removeIngredientEntry(index)}
                      type="button"
                      variant="outline"
                    >
                      <Trash2 className="size-3.5" />
                    </ActionIcon>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error ? (
          <p className="mt-6 rounded-md border border-red-400/20 bg-red-400/10 p-3 font-medium text-red-300 text-sm">
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
      title={state.editingProduct ? "Editar producto" : "Crear producto"}
    >
      <ProductFormSheetContent
        categories={state.categories}
        enabledPaymentMethods={state.enabledPaymentMethods}
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
