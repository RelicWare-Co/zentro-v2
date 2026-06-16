import { Button } from "@mantine/core";
import { Plus } from "lucide-react";
import { useProductsPage } from "@/features/products/products-page-context";

export function CategoriesTab() {
  const { state, actions } = useProductsPage();

  return (
    <>
      <div className="flex justify-end">
        <Button
          c="black"
          color="voltage.5"
          leftSection={<Plus className="size-4" />}
          onClick={actions.openCreateCategory}
          type="button"
        >
          Crear categoría
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {state.categories.map((category) => (
          <button
            className="rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-4 text-left transition-colors hover:border-[var(--color-voltage)]/40"
            key={category.id}
            onClick={() => actions.openEditCategory(category)}
            type="button"
          >
            <p className="font-medium text-white">{category.name}</p>
            <p className="mt-2 line-clamp-2 text-sm text-zinc-400">
              {category.description || "Sin descripción"}
            </p>
          </button>
        ))}
      </div>
      {state.categories.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 border-dashed bg-black/10 p-10 text-center text-sm text-zinc-500">
          Aún no hay categorías.
        </div>
      ) : null}
    </>
  );
}
