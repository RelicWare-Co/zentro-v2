import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProductsField } from "@/features/products/components/products-ui-primitives";
import { useProductsPage } from "@/features/products/products-page-context";
import { getErrorMessage } from "@/lib/utils";

function CategoryDialogContent({
  open,
  onOpenChange,
  category,
  error,
  isPending,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ReturnType<typeof useProductsPage>["state"]["selectedCategory"];
  error: unknown;
  isPending: boolean;
  onSave: ReturnType<typeof useProductsPage>["actions"]["saveCategory"];
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const nameId = useId();
  const descriptionId = useId();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="border-zinc-800 bg-[var(--color-carbon)] text-white sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {category ? "Editar categoría" : "Crear categoría"}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({
              name,
              description: description || null,
            }).catch(() => undefined);
          }}
        >
          <ProductsField htmlFor={nameId} label="Nombre" required>
            <Input
              className="border-zinc-700 bg-black/20"
              id={nameId}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Bebidas"
              required
              value={name}
            />
          </ProductsField>
          <ProductsField htmlFor={descriptionId} label="Descripción">
            <Textarea
              className="min-h-[80px] border-zinc-700 bg-black/20"
              id={descriptionId}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Descripción opcional…"
              value={description}
            />
          </ProductsField>
          {error ? (
            <p className="text-red-400 text-sm">
              {getErrorMessage(error, "No se pudo guardar la categoría.")}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            {category && onDelete ? (
              <Button
                className="border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
                disabled={isPending}
                onClick={() => {
                  onDelete().catch(() => undefined);
                }}
                type="button"
                variant="outline"
              >
                Eliminar
              </Button>
            ) : (
              <span />
            )}
            <Button
              className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
              disabled={isPending || !name.trim()}
              type="submit"
            >
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CategoryDialog() {
  const { state, actions, meta } = useProductsPage();
  const { mutations } = meta;
  const isPending =
    mutations.createCategoryMutation.isPending ||
    mutations.updateCategoryMutation.isPending ||
    mutations.deleteCategoryMutation.isPending;

  return (
    <CategoryDialogContent
      category={state.selectedCategory}
      error={meta.categoryError}
      isPending={isPending}
      key={
        state.isCategoryDialogOpen
          ? (state.selectedCategory?.id ?? "new")
          : "closed"
      }
      onDelete={state.selectedCategory ? actions.deleteCategory : undefined}
      onOpenChange={(open) => {
        if (open) {
          return;
        }
        actions.closeCategoryDialog();
      }}
      onSave={actions.saveCategory}
      open={state.isCategoryDialogOpen}
    />
  );
}
