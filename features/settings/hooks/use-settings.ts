import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useMemo, useRef } from "react";
import { usePageContext } from "vike-react/usePageContext";
import {
  buildSettingsPageData,
  type SettingsPageData,
} from "@/features/settings/organization-environment.shared";
import type { OrganizationSettings } from "@/features/settings/settings.shared";
import {
  getZeroQueryError,
  useZeroMutation,
  waitForZeroMutation,
} from "@/lib/use-zero-mutation";
import { mutators } from "@/src/zero/mutators";
import { queries } from "@/src/zero/queries";

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
    getZeroQueryError(organizationStatus) ??
    getZeroQueryError(entitlementStatus);

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
  return useZeroMutation(
    async (input: { settings: OrganizationSettings }, zero) => {
      await waitForZeroMutation(
        zero.mutate(mutators.organization.updateSettings(input))
      );
      return {
        success: true as const,
        settings: input.settings,
      };
    }
  );
}
