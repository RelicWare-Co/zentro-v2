import { Alert, Button, Loader } from "@mantine/core";
import { useCustomersPage } from "@/features/customers/customers-page-context";
import { getErrorMessage } from "@/lib/utils";

export function CustomersPageLoading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <Loader color="voltage.5" size="lg" />
    </div>
  );
}

export function CustomersPageError() {
  const { actions, meta } = useCustomersPage();

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <Alert
        color="red"
        title="No se pudieron cargar los clientes"
        variant="light"
      >
        <div className="flex flex-col gap-3">
          {getErrorMessage(meta.customersError, "Intenta recargar la página.")}
          <Button
            className="w-fit"
            color="red"
            onClick={actions.refetch}
            size="xs"
            type="button"
            variant="outline"
          >
            Reintentar
          </Button>
        </div>
      </Alert>
    </div>
  );
}
