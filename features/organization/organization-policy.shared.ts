import { isPlatformAdminRole } from "./access-control.shared";

export interface OrganizationAccessPolicy {
  allowSelfServiceCreation: boolean;
  contactHref: string | null;
  contactLabel: string;
  contactMessage: string;
}

export interface OrganizationPolicyInput {
  contactEmail?: string | null;
  contactUrl?: string | null;
  isCreationDisabled?: boolean;
  role?: string | null;
}

export function buildOrganizationAccessPolicy(
  input: OrganizationPolicyInput = {}
): OrganizationAccessPolicy {
  const allowSelfServiceCreation = isPlatformAdminRole(input.role)
    ? true
    : !input.isCreationDisabled;
  const contactEmail = input.contactEmail?.trim() || null;
  const contactUrl = input.contactUrl?.trim() || null;
  const contactHref =
    contactUrl ?? (contactEmail ? `mailto:${contactEmail}` : null);

  return {
    allowSelfServiceCreation,
    contactLabel: contactEmail ?? "Contactar al administrador",
    contactHref,
    contactMessage: allowSelfServiceCreation
      ? "Puedes crear una organización nueva o unirte a una invitación pendiente."
      : "La creación de organizaciones está controlada por administración. Solicita un enlace o una invitación en la app.",
  };
}
