import { oc } from "@orpc/contract";
import {
	CreateCustomerSchema,
	CustomerIdResultSchema,
	CustomerSuccessResultSchema,
	DeleteCustomerSchema,
	SearchCustomersResultSchema,
	SearchCustomersSchema,
	UpdateCustomerSchema,
} from "../../../schemas/customers";

export const customersContract = {
	search: oc
		.route({
			method: "GET",
			path: "/customers",
			summary: "Buscar clientes",
			tags: ["Customers"],
		})
		.input(SearchCustomersSchema)
		.output(SearchCustomersResultSchema),
	create: oc
		.route({
			method: "POST",
			path: "/customers",
			summary: "Crear cliente",
			tags: ["Customers"],
		})
		.input(CreateCustomerSchema)
		.output(CustomerIdResultSchema),
	update: oc
		.route({
			method: "POST",
			path: "/customers/update",
			summary: "Actualizar cliente",
			tags: ["Customers"],
		})
		.input(UpdateCustomerSchema)
		.output(CustomerSuccessResultSchema),
	delete: oc
		.route({
			method: "POST",
			path: "/customers/delete",
			summary: "Eliminar cliente",
			tags: ["Customers"],
		})
		.input(DeleteCustomerSchema)
		.output(CustomerSuccessResultSchema),
};
