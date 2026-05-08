import { oc } from "@orpc/contract";
import { ActiveShiftResultSchema } from "../../../schemas/shifts";

export const shiftsContract = {
	active: oc.route({
		method: "GET",
		path: "/shifts/active",
		summary: "Turno activo del usuario",
		tags: ["Shifts"],
	}).output(ActiveShiftResultSchema),
};
