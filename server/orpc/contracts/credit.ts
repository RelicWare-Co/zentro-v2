import { oc } from "@orpc/contract";
import {
	ListCreditTransactionsResultSchema,
	ListCreditTransactionsSchema,
	RegisterCreditPaymentResultSchema,
	RegisterCreditPaymentSchema,
	SearchCreditAccountsResultSchema,
	SearchCreditAccountsSchema,
} from "../../../schemas/credit";

export const creditContract = {
	searchAccounts: oc
		.route({
			method: "GET",
			path: "/credit/accounts",
			summary: "Buscar cuentas de crédito",
			tags: ["Credit"],
		})
		.input(SearchCreditAccountsSchema)
		.output(SearchCreditAccountsResultSchema),
	transactions: oc
		.route({
			method: "GET",
			path: "/credit/transactions",
			summary: "Listar movimientos de crédito",
			tags: ["Credit"],
		})
		.input(ListCreditTransactionsSchema)
		.output(ListCreditTransactionsResultSchema),
	registerPayment: oc
		.route({
			method: "POST",
			path: "/credit/payments",
			summary: "Registrar abono a crédito",
			tags: ["Credit"],
		})
		.input(RegisterCreditPaymentSchema)
		.output(RegisterCreditPaymentResultSchema),
};
