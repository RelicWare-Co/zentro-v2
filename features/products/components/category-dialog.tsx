import { Button, Group, Modal, Textarea, TextInput } from "@mantine/core";
import { useState } from "react";
import { useProductsPage } from "@/features/products/products-page-context";
import { darkInputStyles, darkModalStyles } from "@/lib/mantine-dark";
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

  return (
    <Modal
      centered
      onClose={() => onOpenChange(false)}
      opened={open}
      styles={darkModalStyles}
      title={category ? "Editar categoría" : "Crear categoría"}
    >
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
        <TextInput
          label="Nombre"
          onChange={(event) => setName(event.target.value)}
          placeholder="Ej. Bebidas"
          required
          styles={darkInputStyles}
          value={name}
          withAsterisk
        />
        <Textarea
          label="Descripción"
          minRows={3}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Descripción opcional…"
          styles={darkInputStyles}
          value={description}
        />
        {error ? (
          <p className="text-red-400 text-sm">
            {getErrorMessage(error, "No se pudo guardar la categoría.")}
          </p>
        ) : null}
        <Group justify={category && onDelete ? "space-between" : "flex-end"}>
          {category && onDelete ? (
            <Button
              color="red"
              disabled={isPending}
              onClick={() => {
                onDelete().catch(() => undefined);
              }}
              type="button"
              variant="outline"
            >
              Eliminar
            </Button>
          ) : null}
          <Button
            c="black"
            color="voltage.5"
            disabled={!name.trim()}
            loading={isPending}
            type="submit"
          >
            Guardar
          </Button>
        </Group>
      </form>
    </Modal>
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
