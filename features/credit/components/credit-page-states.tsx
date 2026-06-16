import { Alert, Loader } from "@mantine/core";
import { useCreditPage } from "@/features/credit/credit-page-context";
import { getErrorMessage } from "@/lib/utils";

export function CreditPageLoading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <Loader color="voltage.5" size="lg" />
    </div>
  );
}

export function CreditPageError() {
  const { meta } = useCreditPage();

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <Alert
        color="red"
        title="No se pudieron cargar las cuentas de crédito"
        variant="light"
      >
        {getErrorMessage(meta.accountsError, "Intenta recargar la página.")}
      </Alert>
    </div>
  );
}
