import { oc } from "@orpc/contract";
import {
	CreateJoinLinkSchema,
	CreateJoinLinkResultSchema,
	JoinLinkPreviewSchema,
	JoinLinkRedeemResultSchema,
	JoinTokenSchema,
	OrganizationManagementSchema,
	OrganizationSelectionSchema,
	RevokeJoinLinkSchema,
	RevokeJoinLinkResultSchema,
} from "../../../schemas/organization";

export const organizationContract = {
	joinLinkPreview: oc
		.route({
			method: "GET",
			path: "/organization/join-link/preview",
			summary: "Preview de un join link",
			tags: ["Organization"],
		})
		.input(JoinTokenSchema)
		.output(JoinLinkPreviewSchema),
	joinLinkRedeem: oc
		.route({
			method: "POST",
			path: "/organization/join-link/redeem",
			summary: "Canjear un join link",
			tags: ["Organization"],
		})
		.input(JoinTokenSchema)
		.output(JoinLinkRedeemResultSchema),
	selection: oc
		.route({
			method: "GET",
			path: "/organization/selection",
			summary: "Datos de selección de organización",
			tags: ["Organization"],
		})
		.output(OrganizationSelectionSchema),
	management: oc
		.route({
			method: "GET",
			path: "/organization/management",
			summary: "Datos de gestión de organización",
			tags: ["Organization"],
		})
		.output(OrganizationManagementSchema),
	joinLinkCreate: oc
		.route({
			method: "POST",
			path: "/organization/join-link",
			summary: "Crear un join link",
			tags: ["Organization"],
		})
		.input(CreateJoinLinkSchema)
		.output(CreateJoinLinkResultSchema),
	joinLinkRevoke: oc
		.route({
			method: "POST",
			path: "/organization/join-link/revoke",
			summary: "Revocar un join link",
			tags: ["Organization"],
		})
		.input(RevokeJoinLinkSchema)
		.output(RevokeJoinLinkResultSchema),
};
