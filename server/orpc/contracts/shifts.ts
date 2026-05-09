import { oc } from "@orpc/contract";
import {
	ActiveShiftResultSchema,
	GetShiftByIdInputSchema,
	ListShiftsInputSchema,
	ListShiftsResultSchema,
	ShiftDetailSchema,
} from "../../../schemas/shifts";
import {
	CloseShiftInputSchema,
	CloseShiftResultSchema,
	OpenShiftInputSchema,
	OpenShiftResultSchema,
	RegisterCashMovementInputSchema,
	RegisterCashMovementResultSchema,
	ShiftCloseSummaryInputSchema,
	ShiftCloseSummaryResultSchema,
} from "../../../schemas/pos";

export const shiftsContract = {
	list: oc
		.route({
			method: "GET",
			path: "/shifts",
			summary: "Listado de turnos",
			tags: ["Shifts"],
		})
		.input(ListShiftsInputSchema)
		.output(ListShiftsResultSchema),
	detail: oc
		.route({
			method: "GET",
			path: "/shifts/detail",
			summary: "Detalle de turno",
			tags: ["Shifts"],
		})
		.input(GetShiftByIdInputSchema)
		.output(ShiftDetailSchema),
	active: oc.route({
		method: "GET",
		path: "/shifts/active",
		summary: "Turno activo del usuario",
		tags: ["Shifts"],
	}).output(ActiveShiftResultSchema),
	open: oc
		.route({
			method: "POST",
			path: "/shifts/open",
			summary: "Abrir turno",
			tags: ["Shifts"],
		})
		.input(OpenShiftInputSchema)
		.output(OpenShiftResultSchema),
	close: oc
		.route({
			method: "POST",
			path: "/shifts/close",
			summary: "Cerrar turno",
			tags: ["Shifts"],
		})
		.input(CloseShiftInputSchema)
		.output(CloseShiftResultSchema),
	cashMovement: oc
		.route({
			method: "POST",
			path: "/shifts/cash-movement",
			summary: "Registrar movimiento de caja",
			tags: ["Shifts"],
		})
		.input(RegisterCashMovementInputSchema)
		.output(RegisterCashMovementResultSchema),
	closeSummary: oc
		.route({
			method: "POST",
			path: "/shifts/close-summary",
			summary: "Resumen de cierre de turno",
			tags: ["Shifts"],
		})
		.input(ShiftCloseSummaryInputSchema)
		.output(ShiftCloseSummaryResultSchema),
};
