import {
	joinLinkPreview,
	joinLinkRedeem,
	selection,
	management,
	joinLinkCreate,
	joinLinkRevoke,
	inviteMember,
	cancelInvitation,
	updateMemberRole,
	removeMember,
	leaveOrganization,
	updateOrganization,
	deleteOrganization,
} from "./organization";
import { capabilities, setEntitlement } from "./modules";
import { get as getSettings, update as updateSettings } from "./settings";
import {
	categories,
	create,
	createCategory,
	deleteCategory,
	deleteProduct,
	list,
	registerInventoryMovement,
	update,
	updateCategory,
} from "./products";
import {
	create as createCustomer,
	deleteCustomer,
	search as searchCustomers,
	update as updateCustomer,
} from "./customers";
import {
	registerPayment as registerCreditPayment,
	searchAccounts as searchCreditAccounts,
	transactions as listCreditTransactions,
} from "./credit";
import { overview as dashboardOverview } from "./dashboard";
import {
	list as listSales,
	detail as saleDetail,
	create as createSale,
	cancel as cancelSale,
} from "./sales";
import {
	list as listShifts,
	detail as shiftDetail,
	active as activeShift,
	open as openShift,
	close as closeShift,
	cashMovement as registerCashMovement,
	closeSummary as shiftCloseSummary,
} from "./shifts";
import {
	bootstrap as posBootstrap,
	searchProducts as posSearchProducts,
	toggleFavorite as posToggleFavorite,
} from "./pos";
import {
	bootstrap as restaurantBootstrap,
	tableDetail,
	addOrderItem,
	updateOrderMeta,
	updateDraftItem,
	deleteDraftItem,
	sendToKitchen,
	updateItemStatus,
	closeOrder,
	configuration,
	createArea,
	updateArea,
	deleteArea,
	createTable,
	updateTable,
	deleteTable,
	kitchenBoard,
} from "./restaurants";

export const router = {
	organization: {
		joinLinkPreview,
		joinLinkRedeem,
		selection,
		management,
		joinLinkCreate,
		joinLinkRevoke,
		inviteMember,
		cancelInvitation,
		updateMemberRole,
		removeMember,
		leaveOrganization,
		updateOrganization,
		deleteOrganization,
	},
	modules: {
		capabilities,
		setEntitlement,
	},
	settings: {
		get: getSettings,
		update: updateSettings,
	},
	products: {
		list,
		categories,
		create,
		update,
		delete: deleteProduct,
		registerInventoryMovement,
		createCategory,
		updateCategory,
		deleteCategory,
	},
	customers: {
		search: searchCustomers,
		create: createCustomer,
		update: updateCustomer,
		delete: deleteCustomer,
	},
	credit: {
		searchAccounts: searchCreditAccounts,
		transactions: listCreditTransactions,
		registerPayment: registerCreditPayment,
	},
	dashboard: {
		overview: dashboardOverview,
	},
	sales: {
		list: listSales,
		detail: saleDetail,
		create: createSale,
		cancel: cancelSale,
	},
	shifts: {
		list: listShifts,
		detail: shiftDetail,
		active: activeShift,
		open: openShift,
		close: closeShift,
		cashMovement: registerCashMovement,
		closeSummary: shiftCloseSummary,
	},
	pos: {
		bootstrap: posBootstrap,
		searchProducts: posSearchProducts,
		toggleFavorite: posToggleFavorite,
	},
	restaurants: {
		bootstrap: restaurantBootstrap,
		tableDetail,
		addOrderItem,
		updateOrderMeta,
		updateDraftItem,
		deleteDraftItem,
		sendToKitchen,
		updateItemStatus,
		closeOrder,
		configuration,
		createArea,
		updateArea,
		deleteArea,
		createTable,
		updateTable,
		deleteTable,
		kitchenBoard,
	},
};
