import { useZero } from "@rocicorp/zero/react";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";

export type ZeroMutationDetails =
  | { readonly type: "success" }
  | {
      readonly error: { readonly message: string };
      readonly type: "error";
    };

export interface ZeroMutationResult {
  readonly client: Promise<ZeroMutationDetails>;
  readonly server: Promise<ZeroMutationDetails>;
}

function toZeroMutationError(
  details: Extract<ZeroMutationDetails, { type: "error" }>
) {
  return new Error(details.error.message || "La mutación de Zero falló");
}

export async function waitForZeroMutation(result: ZeroMutationResult) {
  const clientResult = await result.client;
  if (clientResult.type === "error") {
    throw toZeroMutationError(clientResult);
  }

  const serverResult = await result.server;
  if (serverResult.type === "error") {
    throw toZeroMutationError(serverResult);
  }
}

export function getZeroQueryError(status: {
  type: string;
  error?: { message?: string };
}) {
  return status.type === "error"
    ? new Error(status.error?.message ?? "No se pudo cargar la consulta Zero")
    : null;
}

type ZeroClient = ReturnType<typeof useZero>;

export function useZeroMutation<TData, TVariables = void>(
  mutationFn: (variables: TVariables, zero: ZeroClient) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, "mutationFn">
) {
  const zero = useZero();

  return useMutation({
    ...options,
    mutationFn: (variables) => mutationFn(variables, zero),
  });
}
