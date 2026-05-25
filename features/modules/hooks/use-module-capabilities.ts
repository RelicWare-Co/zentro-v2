import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useMemo, useRef } from "react";
import { usePageContext } from "vike-react/usePageContext";
import {
  buildModuleCapabilities,
  type ModuleEntitlementRow,
} from "@/features/settings/organization-environment.shared";
import { parseOrganizationSettingsMetadata } from "@/features/settings/settings.shared";
import { getZeroQueryError } from "@/lib/use-zero-mutation";
import { queries } from "@/src/zero/queries";

export function useModuleCapabilities() {
  const pageContext = usePageContext();
  const zeroContext = pageContext.zeroContext;
  const [organizationRows, organizationStatus] = useZeroQuery(
    queries.modules.capabilities()
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

    return buildModuleCapabilities({
      ctx: zeroContext,
      entitlementRows: entitlementRows as ModuleEntitlementRow[],
      settings: parseOrganizationSettingsMetadata(organizationRow.metadata),
    });
  }, [entitlementRows, organizationRows, zeroContext]);

  const hasLoadedRef = useRef(false);
  const staleDataRef = useRef(data);
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
  };
}
