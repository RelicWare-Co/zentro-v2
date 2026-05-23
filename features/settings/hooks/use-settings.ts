import { useZero, useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import { usePageContext } from "vike-react/usePageContext";
import {
  buildSettingsPageData,
  type SettingsPageData,
} from "@/features/settings/organization-environment.shared";
import type { OrganizationSettings } from "@/features/settings/settings.shared";
import { mutators } from "@/src/zero/mutators";
import { queries } from "@/src/zero/queries";

type ZeroMutationDetails =
  | { readonly type: "success" }
  | {
      readonly error: { readonly message: string };
      readonly type: "error";
    };

interface ZeroMutationResult {
  readonly client: Promise<ZeroMutationDetails>;
  readonly server: Promise<ZeroMutationDetails>;
}

function toError(details: Extract<ZeroMutationDetails, { type: "error" }>) {
  return new Error(details.error.message || "La mutación de Zero falló");
}

async function waitForZeroMutation(result: ZeroMutationResult) {
  const clientResult = await result.client;
  if (clientResult.type === "error") {
    throw toError(clientResult);
  }

  const serverResult = await result.server;
  if (serverResult.type === "error") {
    throw toError(serverResult);
  }
}

function getQueryError(status: { type: string; error?: { message?: string } }) {
  return status.type === "error"
    ? new Error(status.error?.message ?? "No se pudo cargar la consulta Zero")
    : null;
}

export function useSettings() {
  const pageContext = usePageContext();
  const zeroContext = pageContext.zeroContext;
  const [organizationRows, organizationStatus] = useZeroQuery(
    queries.organization.environment()
  );
  const [entitlementRows, entitlementStatus] = useZeroQuery(
    queries.organization.moduleEntitlements()
  );
  const error =
    getQueryError(organizationStatus) ?? getQueryError(entitlementStatus);

  const data = useMemo(() => {
    if (!zeroContext) {
      return null;
    }

    const organizationRow = organizationRows[0];
    if (!organizationRow) {
      return null;
    }

    return buildSettingsPageData({
      organizationRow,
      entitlementRows,
      ctx: zeroContext,
    });
  }, [entitlementRows, organizationRows, zeroContext]);

  const hasLoadedRef = useRef(false);
  const staleDataRef = useRef<SettingsPageData | null>(null);
  const isQueryLoading =
    Boolean(zeroContext) &&
    organizationStatus.type === "unknown" &&
    organizationRows.length === 0 &&
    !error;

  if (!isQueryLoading && data) {
    staleDataRef.current = data;
    hasLoadedRef.current = true;
  }

  const displayData = isQueryLoading ? staleDataRef.current : data;

  return {
    data: displayData ?? undefined,
    error,
    isError: Boolean(error),
    isPending: isQueryLoading && !hasLoadedRef.current,
    isLoading: isQueryLoading && !hasLoadedRef.current,
    refetch: () => {
      if (organizationStatus.type === "error") {
        organizationStatus.retry();
      }
      if (entitlementStatus.type === "error") {
        entitlementStatus.retry();
      }
      return Promise.resolve();
    },
  };
}

export function useUpdateSettingsMutation() {
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: { settings: OrganizationSettings }) => {
      await waitForZeroMutation(
        zero.mutate(mutators.organization.updateSettings(input))
      );
      return {
        success: true as const,
        settings: input.settings,
      };
    },
  });
}
