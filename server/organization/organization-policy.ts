import { buildOrganizationAccessPolicy } from "@/features/organization/organization-policy.shared";

const DISABLED_FLAG_VALUES = new Set(["0", "false", "no", "off"]);

interface OrganizationPolicyUser {
  role?: string | null;
}

function isDisabledFlag(value: string | undefined) {
  return value ? DISABLED_FLAG_VALUES.has(value.trim().toLowerCase()) : false;
}

export function getOrganizationAccessPolicy(user?: OrganizationPolicyUser) {
  return buildOrganizationAccessPolicy({
    role: user?.role,
    isCreationDisabled: isDisabledFlag(process.env.ALLOW_ORGANIZATION_CREATION),
    contactEmail: process.env.ORGANIZATION_CONTACT_EMAIL,
    contactUrl: process.env.ORGANIZATION_CONTACT_URL,
  });
}
