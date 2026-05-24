export const ORGANIZATION_TAB_VALUES = [
  "general",
  "members",
  "invitations",
  "access",
] as const;

export type OrganizationTab = (typeof ORGANIZATION_TAB_VALUES)[number];

export const ORGANIZATION_ROLE_OPTIONS = [
  { value: "member", label: "Miembro" },
  { value: "admin", label: "Admin" },
  { value: "owner", label: "Owner" },
] as const;
