import { useOrganizationTransition } from "@/features/organization/organization-transition-context";
import type { ZeroContext } from "@/zero/sdk";

/**
 * Stable Zero auth context for client hooks.
 *
 * The root transition provider owns the client-side copy so organization
 * changes can update Zero without a full page reload.
 */
export function usePageZeroContext(): ZeroContext | null {
  return useOrganizationTransition().zeroContext;
}
