import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCreditPage } from "@/features/credit/credit-page-context";
import { getErrorMessage } from "@/lib/utils";

export function CreditPageLoading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-[var(--color-voltage)]" />
    </div>
  );
}

export function CreditPageError() {
  const { meta } = useCreditPage();

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <Alert
        className="border-red-500/20 bg-red-500/10 text-red-100"
        variant="destructive"
      >
        <AlertTitle>No se pudieron cargar las cuentas de crédito</AlertTitle>
        <AlertDescription>
          {getErrorMessage(meta.accountsError, "Intenta recargar la página.")}
        </AlertDescription>
      </Alert>
    </div>
  );
}
