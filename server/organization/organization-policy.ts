import { isPlatformAdminRole } from "./access-control.shared";

const DISABLED_FLAG_VALUES = new Set(["0", "false", "no", "off"]);

type OrganizationPolicyUser = {
	role?: string | null;
};

function isDisabledFlag(value: string | undefined) {
	return value ? DISABLED_FLAG_VALUES.has(value.trim().toLowerCase()) : false;
}

export function canUserCreateOrganization(user?: OrganizationPolicyUser) {
	if (isPlatformAdminRole(user?.role)) {
		return true;
	}

	return !isDisabledFlag(process.env.ALLOW_ORGANIZATION_CREATION);
}

export function getOrganizationAccessPolicy(user?: OrganizationPolicyUser) {
	const allowSelfServiceCreation = canUserCreateOrganization(user);
	const contactEmail = process.env.ORGANIZATION_CONTACT_EMAIL?.trim() || null;
	const contactUrl = process.env.ORGANIZATION_CONTACT_URL?.trim() || null;
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
