import { Alert, Loader } from "@mantine/core";
import { useProductsPage } from "@/features/products/products-page-context";
import { getErrorMessage } from "@/lib/utils";

export function ProductsPageLoading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <Loader color="voltage.5" size="lg" />
    </div>
  );
}

export function ProductsPageError() {
  const { state } = useProductsPage();

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <Alert color="red" title="No se pudo cargar inventario" variant="light">
        {getErrorMessage(state.error, "Intenta recargar la página.")}
      </Alert>
    </div>
  );
}
