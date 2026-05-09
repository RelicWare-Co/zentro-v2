import { oc } from "@orpc/contract";
import { z } from "zod";
import {
	AddRestaurantOrderItemInputSchema,
	CloseRestaurantOrderInputSchema,
	CreateRestaurantAreaInputSchema,
	CreateRestaurantTableInputSchema,
	DeleteRestaurantAreaInputSchema,
	DeleteRestaurantDraftItemInputSchema,
	DeleteRestaurantTableInputSchema,
	KitchenBoardSchema,
	RestaurantBootstrapSchema,
	RestaurantConfigurationSchema,
	RestaurantTableDetailInputSchema,
	RestaurantTableDetailSchema,
	SendRestaurantOrderToKitchenInputSchema,
	SendToKitchenResultSchema,
	SuccessResultSchema,
	UpdateRestaurantAreaInputSchema,
	UpdateRestaurantDraftItemInputSchema,
	UpdateRestaurantOrderItemStatusInputSchema,
	UpdateRestaurantOrderMetaInputSchema,
	UpdateRestaurantTableInputSchema,
} from "../../../schemas/restaurants";

export const restaurantsContract = {
	bootstrap: oc
		.route({
			method: "GET",
			path: "/restaurants/bootstrap",
			summary: "Datos iniciales del módulo restaurantes",
			tags: ["Restaurants"],
		})
		.output(RestaurantBootstrapSchema),
	tableDetail: oc
		.route({
			method: "POST",
			path: "/restaurants/table-detail",
			summary: "Detalle de mesa y cuenta abierta",
			tags: ["Restaurants"],
		})
		.input(RestaurantTableDetailInputSchema)
		.output(RestaurantTableDetailSchema),
	addOrderItem: oc
		.route({
			method: "POST",
			path: "/restaurants/order-item",
			summary: "Agregar ítem a cuenta de mesa",
			tags: ["Restaurants"],
		})
		.input(AddRestaurantOrderItemInputSchema)
		.output(
			z.object({
				orderId: z.string(),
				itemId: z.string(),
				tableId: z.string(),
			}),
		),
	updateOrderMeta: oc
		.route({
			method: "POST",
			path: "/restaurants/order-meta",
			summary: "Actualizar meta de cuenta",
			tags: ["Restaurants"],
		})
		.input(UpdateRestaurantOrderMetaInputSchema)
		.output(SuccessResultSchema),
	updateDraftItem: oc
		.route({
			method: "POST",
			path: "/restaurants/draft-item",
			summary: "Actualizar ítem en borrador",
			tags: ["Restaurants"],
		})
		.input(UpdateRestaurantDraftItemInputSchema)
		.output(SuccessResultSchema),
	deleteDraftItem: oc
		.route({
			method: "POST",
			path: "/restaurants/draft-item/delete",
			summary: "Eliminar ítem en borrador",
			tags: ["Restaurants"],
		})
		.input(DeleteRestaurantDraftItemInputSchema)
		.output(SuccessResultSchema),
	sendToKitchen: oc
		.route({
			method: "POST",
			path: "/restaurants/send-to-kitchen",
			summary: "Enviar cuenta a cocina",
			tags: ["Restaurants"],
		})
		.input(SendRestaurantOrderToKitchenInputSchema)
		.output(SendToKitchenResultSchema),
	updateItemStatus: oc
		.route({
			method: "POST",
			path: "/restaurants/item-status",
			summary: "Actualizar estado de ítem de cocina",
			tags: ["Restaurants"],
		})
		.input(UpdateRestaurantOrderItemStatusInputSchema)
		.output(SuccessResultSchema),
	closeOrder: oc
		.route({
			method: "POST",
			path: "/restaurants/close-order",
			summary: "Cerrar cuenta de mesa",
			tags: ["Restaurants"],
		})
		.input(CloseRestaurantOrderInputSchema)
		.output(
			z.object({
				saleId: z.string(),
				status: z.string(),
				subtotal: z.number(),
				taxAmount: z.number(),
				discountAmount: z.number(),
				totalAmount: z.number(),
				paidAmount: z.number(),
				balanceDue: z.number(),
			}),
		),
	configuration: oc
		.route({
			method: "GET",
			path: "/restaurants/configuration",
			summary: "Configuración de zonas y mesas",
			tags: ["Restaurants"],
		})
		.output(RestaurantConfigurationSchema),
	createArea: oc
		.route({
			method: "POST",
			path: "/restaurants/areas",
			summary: "Crear zona",
			tags: ["Restaurants"],
		})
		.input(CreateRestaurantAreaInputSchema)
		.output(RestaurantConfigurationSchema),
	updateArea: oc
		.route({
			method: "POST",
			path: "/restaurants/areas/update",
			summary: "Actualizar zona",
			tags: ["Restaurants"],
		})
		.input(UpdateRestaurantAreaInputSchema)
		.output(RestaurantConfigurationSchema),
	deleteArea: oc
		.route({
			method: "POST",
			path: "/restaurants/areas/delete",
			summary: "Eliminar zona",
			tags: ["Restaurants"],
		})
		.input(DeleteRestaurantAreaInputSchema)
		.output(RestaurantConfigurationSchema),
	createTable: oc
		.route({
			method: "POST",
			path: "/restaurants/tables",
			summary: "Crear mesa",
			tags: ["Restaurants"],
		})
		.input(CreateRestaurantTableInputSchema)
		.output(RestaurantConfigurationSchema),
	updateTable: oc
		.route({
			method: "POST",
			path: "/restaurants/tables/update",
			summary: "Actualizar mesa",
			tags: ["Restaurants"],
		})
		.input(UpdateRestaurantTableInputSchema)
		.output(RestaurantConfigurationSchema),
	deleteTable: oc
		.route({
			method: "POST",
			path: "/restaurants/tables/delete",
			summary: "Eliminar mesa",
			tags: ["Restaurants"],
		})
		.input(DeleteRestaurantTableInputSchema)
		.output(RestaurantConfigurationSchema),
	kitchenBoard: oc
		.route({
			method: "GET",
			path: "/restaurants/kitchen",
			summary: "Tablero de cocina",
			tags: ["Restaurants"],
		})
		.output(KitchenBoardSchema),
};
