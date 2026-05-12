import { z } from "zod";
import {
	restaurantModuleSettingsSchema,
	restaurantModuleToggleSettingsSchema,
} from "@/features/restaurants/restaurants.module";
import {
	normalizePaymentMethodId,
	PAYMENT_METHOD_ID_PATTERN,
} from "@/features/settings/settings.shared";
import { ModuleAccessStateSchema, ModuleKeySchema } from "./modules";

const paymentMethodIdSchema = z
	.string()
	.trim()
	.min(1)
	.max(40)
	.transform(normalizePaymentMethodId)
	.refine((value) => PAYMENT_METHOD_ID_PATTERN.test(value), {
		message: "El identificador del método de pago es inválido",
	});

const PaymentMethodSettingsSchema = z.object({
	id: paymentMethodIdSchema,
	label: z.string().trim().min(1).max(40),
	enabled: z.boolean(),
	requiresReference: z.boolean(),
});

const PaymentMethodsSchema = z
	.array(PaymentMethodSettingsSchema)
	.min(1)
	.superRefine((paymentMethods, ctx) => {
		const seenMethodIds = new Set<string>();
		let hasCashMethod = false;
		let hasEnabledMethod = false;

		for (const [index, paymentMethod] of paymentMethods.entries()) {
			if (seenMethodIds.has(paymentMethod.id)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `Método de pago duplicado: ${paymentMethod.id}`,
					path: [index, "id"],
				});
			}

			seenMethodIds.add(paymentMethod.id);
			hasCashMethod = hasCashMethod || paymentMethod.id === "cash";
			hasEnabledMethod = hasEnabledMethod || paymentMethod.enabled;

			if (paymentMethod.id === "cash" && !paymentMethod.enabled) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Efectivo debe permanecer activo para apertura y cierre",
					path: [index, "enabled"],
				});
			}
		}

		if (!hasCashMethod) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "La configuración debe incluir el método efectivo",
				path: [],
			});
		}

		if (!hasEnabledMethod) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Debes mantener al menos un método de pago activo",
				path: [],
			});
		}
	});

const OrganizationSettingsSchema = z.object({
	modules: z.object({
		restaurants: restaurantModuleToggleSettingsSchema,
	}),
	restaurants: restaurantModuleSettingsSchema,
	pos: z.object({
		defaultTerminalName: z.string().trim().min(1).max(80),
		defaultStartingCash: z.number().int().min(0),
		paymentMethods: PaymentMethodsSchema,
	}),
	credit: z.object({
		allowCreditSales: z.boolean(),
		defaultInterestRate: z.number().int().min(0).max(100),
	}),
	inventory: z.object({
		defaultTaxRate: z.number().int().min(0).max(100),
		trackInventoryByDefault: z.boolean(),
		modifiersEnabledByDefault: z.boolean(),
		lowStockThreshold: z.number().int().min(0).max(9999),
	}),
});

export const SettingsDataSchema = z.object({
	organization: z.object({
		id: z.string(),
		name: z.string(),
		slug: z.string(),
		logo: z.string().nullable().optional(),
		createdAt: z.number(),
	}),
	stats: z.object({
		membersCount: z.number(),
		invitationsCount: z.number(),
		productsCount: z.number(),
		customersCount: z.number(),
	}),
	viewer: z.object({
		canManageSettings: z.boolean(),
		isPlatformAdmin: z.boolean(),
	}),
	modules: z.record(ModuleKeySchema, ModuleAccessStateSchema),
	settings: OrganizationSettingsSchema,
});

export const UpdateSettingsSchema = z.object({
	settings: OrganizationSettingsSchema,
});

export const UpdateSettingsResultSchema = z.object({
	success: z.boolean(),
	settings: OrganizationSettingsSchema,
});
