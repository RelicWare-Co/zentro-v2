import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useRef } from "react";
import { usePageContext } from "vike-react/usePageContext";
import {
  buildModuleCapabilities,
  type ModuleEntitlementRow,
} from "@/features/settings/organization-environment.shared";
import { parseOrganizationSettingsMetadata } from "@/features/settings/settings.shared";
import { getZeroQueryError } from "@/lib/use-zero-mutation";
import { queries } from "@/zero/queries";

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

  const data =
    zeroContext && organizationRows[0]
      ? buildModuleCapabilities({
          ctx: zeroContext,
          entitlementRows: entitlementRows as ModuleEntitlementRow[],
          settings: parseOrganizationSettingsMetadata(
            organizationRows[0].metadata
          ),
        })
      : null;

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
