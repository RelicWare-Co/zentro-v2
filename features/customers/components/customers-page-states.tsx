import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useCustomersPage } from "@/features/customers/customers-page-context";
import { getErrorMessage } from "@/lib/utils";

export function CustomersPageLoading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-[var(--color-voltage)]" />
    </div>
  );
}

export function CustomersPageError() {
  const { actions, meta } = useCustomersPage();

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <Alert
        className="border-red-500/20 bg-red-500/10 text-red-100"
        variant="destructive"
      >
        <AlertTitle>No se pudieron cargar los clientes</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          {getErrorMessage(meta.customersError, "Intenta recargar la página.")}
          <Button
            className="mt-1 w-fit border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
            onClick={actions.refetch}
            size="sm"
            type="button"
            variant="outline"
          >
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
