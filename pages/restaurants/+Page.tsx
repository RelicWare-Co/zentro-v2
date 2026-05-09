import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { usePosProducts } from "@/features/pos/hooks/use-pos-queries";
import { formatCurrency } from "@/features/pos/utils";
import {
	useAddRestaurantOrderItemMutation,
	useCloseRestaurantOrderMutation,
	useDeleteRestaurantDraftItemMutation,
	useRestaurantBootstrap,
	useRestaurantTableDetail,
	useSendRestaurantOrderToKitchenMutation,
	useUpdateRestaurantDraftItemMutation,
	useUpdateRestaurantOrderItemStatusMutation,
	useUpdateRestaurantOrderMetaMutation,
} from "@/features/restaurants/hooks/use-restaurants";

export default function RestaurantsPage() {
	const {
		data: bootstrap,
		isError: isBootstrapError,
		error: bootstrapError,
	} = useRestaurantBootstrap();
	const allTables = useMemo(
		() => bootstrap?.areas.flatMap((area) => area.tables) ?? [],
		[bootstrap?.areas],
	);
	const [selectedTableId, setSelectedTableId] = useState<string | null>(
		() => allTables[0]?.id ?? null,
	);
	const resolvedSelectedTableId =
		selectedTableId && allTables.some((table) => table.id === selectedTableId)
			? selectedTableId
			: (allTables[0]?.id ?? null);
	const selectedTableDetailQuery = useRestaurantTableDetail(
		resolvedSelectedTableId,
	);
	const selectedTableDetail = selectedTableDetailQuery.data ?? null;
	const selectedTable = selectedTableDetail?.table ?? null;
	const openOrder = selectedTableDetail?.openOrder ?? null;
	const [searchQuery, setSearchQuery] = useState("");
	const deferredSearchQuery = useDeferredValue(searchQuery);
	const [activeCategoryId, setActiveCategoryId] = useState("all");
	const { data: productSearchResult } = usePosProducts(
		activeCategoryId,
		deferredSearchQuery,
	);
	const [guestCountInput, setGuestCountInput] = useState("0");
	const [orderNotes, setOrderNotes] = useState("");
	const openOrderDraftSignature = openOrder
		? `${openOrder.id}:${openOrder.guestCount}:${openOrder.notes ?? ""}`
		: "empty";
	const [previousOpenOrderDraftSignature, setPreviousOpenOrderDraftSignature] =
		useState(openOrderDraftSignature);
	const [paymentMethod, setPaymentMethod] = useState(
		bootstrap?.settings.paymentMethods[0]?.id ?? "cash",
	);
	const [paymentReference, setPaymentReference] = useState("");
	const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

	useEffect(() => {
		if (!bootstrap) return;
		setPaymentMethod((prev) => {
			const stillValid = bootstrap.settings.paymentMethods.some(
				(m) => m.id === prev,
			);
			return stillValid
				? prev
				: (bootstrap.settings.paymentMethods[0]?.id ?? "cash");
		});
	}, [bootstrap]);

	const addItemMutation = useAddRestaurantOrderItemMutation();
	const updateOrderMetaMutation = useUpdateRestaurantOrderMetaMutation();
	const updateDraftItemMutation = useUpdateRestaurantDraftItemMutation();
	const deleteDraftItemMutation = useDeleteRestaurantDraftItemMutation();
	const sendToKitchenMutation = useSendRestaurantOrderToKitchenMutation();
	const updateItemStatusMutation = useUpdateRestaurantOrderItemStatusMutation();
	const closeOrderMutation = useCloseRestaurantOrderMutation();

	if (openOrderDraftSignature !== previousOpenOrderDraftSignature) {
		setPreviousOpenOrderDraftSignature(openOrderDraftSignature);
		if (!openOrder) {
			setGuestCountInput("0");
			setOrderNotes("");
		} else {
			setGuestCountInput(String(openOrder.guestCount));
			setOrderNotes(openOrder.notes ?? "");
		}
	}
	const products = productSearchResult?.data ?? [];
	const requiresReference =
		bootstrap?.settings.paymentMethods.find(
			(method) => method.id === paymentMethod,
		)?.requiresReference ?? false;

	const handleSelectTable = (tableId: string) => {
		startTransition(() => {
			setSelectedTableId(tableId);
		});
	};

	const handleAddProduct = async (productId: string) => {
		if (!resolvedSelectedTableId) {
			return;
		}

		setFeedbackMessage(null);
		try {
			await addItemMutation.mutateAsync({
				tableId: resolvedSelectedTableId,
				productId,
				quantity: 1,
				notes: null,
			});
		} catch (error) {
			setFeedbackMessage(
				error instanceof Error
					? error.message
					: "No se pudo agregar el producto a la mesa.",
			);
		}
	};

	const handleSaveOrderMeta = async () => {
		if (!openOrder) {
			return;
		}

		setFeedbackMessage(null);
		try {
			await updateOrderMetaMutation.mutateAsync({
				orderId: openOrder.id,
				guestCount: Number(guestCountInput) || 0,
				notes: orderNotes,
			});
			setFeedbackMessage("La cuenta fue actualizada.");
		} catch (error) {
			setFeedbackMessage(
				error instanceof Error
					? error.message
					: "No se pudo actualizar la cuenta.",
			);
		}
	};

	const handleSendToKitchen = async () => {
		if (!openOrder) {
			return;
		}

		setFeedbackMessage(null);
		try {
			const result = await sendToKitchenMutation.mutateAsync({
				orderId: openOrder.id,
			});
			// Kitchen ticket printing deferred to Milestone 11
			if (result.printing.enabled && result.printing.autoPrintOnSend) {
				// TODO(Milestone 11): build and print kitchen ticket
			}
			setFeedbackMessage("La comanda fue enviada a cocina.");
		} catch (error) {
			setFeedbackMessage(
				error instanceof Error
					? error.message
					: "No se pudo enviar la comanda a cocina.",
			);
		}
	};

	const handleUpdateDraftQuantity = async (
		orderItemId: string,
		nextQuantity: number,
	) => {
		if (nextQuantity <= 0) {
			return;
		}

		setFeedbackMessage(null);
		try {
			await updateDraftItemMutation.mutateAsync({
				orderItemId,
				quantity: nextQuantity,
				notes: null,
			});
		} catch (error) {
			setFeedbackMessage(
				error instanceof Error
					? error.message
					: "No se pudo actualizar el ítem.",
			);
		}
	};

	const handleDeleteDraftItem = async (orderItemId: string) => {
		const confirmed = window.confirm(
			"¿Quitar este ítem de la cuenta? Solo aplica para ítems que aún no se han enviado.",
		);
		if (!confirmed) {
			return;
		}

		setFeedbackMessage(null);
		try {
			await deleteDraftItemMutation.mutateAsync({
				orderItemId,
			});
		} catch (error) {
			setFeedbackMessage(
				error instanceof Error ? error.message : "No se pudo eliminar el ítem.",
			);
		}
	};

	const handleMarkItemServed = async (orderItemId: string) => {
		setFeedbackMessage(null);
		try {
			await updateItemStatusMutation.mutateAsync({
				orderItemId,
				status: "served",
			});
		} catch (error) {
			setFeedbackMessage(
				error instanceof Error
					? error.message
					: "No se pudo actualizar el estado.",
			);
		}
	};

	const handleCloseOrder = async () => {
		if (!openOrder || !bootstrap?.activeShift) {
			return;
		}

		setFeedbackMessage(null);
		try {
			await closeOrderMutation.mutateAsync({
				orderId: openOrder.id,
				shiftId: bootstrap.activeShift.id,
				customerId: null,
				payments: [
					{
						method: paymentMethod,
						amount: openOrder.totals.totalAmount,
						reference: paymentReference || null,
					},
				],
			});
			setPaymentReference("");
			setFeedbackMessage("La mesa fue cobrada y cerrada.");
		} catch (error) {
			setFeedbackMessage(
				error instanceof Error ? error.message : "No se pudo cerrar la mesa.",
			);
		}
	};

	return (
		<main className="min-h-full bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8">
			{isBootstrapError ? (
				<Alert
					variant="destructive"
					className="border-red-500/20 bg-red-500/10 text-red-100"
				>
					<AlertTitle>Acceso denegado</AlertTitle>
					<AlertDescription>
						{bootstrapError instanceof Error
							? bootstrapError.message
							: "No tienes acceso al módulo de restaurantes."}
					</AlertDescription>
				</Alert>
			) : null}

			<div className="mb-6 flex items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold">Restaurantes</h1>
					<p className="mt-1 text-sm text-gray-400">
						Mesas, comandas y cierre de cuenta sobre el POS actual.
					</p>
				</div>
				{bootstrap?.settings.restaurant.kitchen.displayEnabled ? (
					<Button
						asChild
						variant="outline"
						className="border-gray-700 bg-transparent text-gray-100 hover:bg-white/5"
					>
						<a href="/kitchen">Ver Cocina</a>
					</Button>
				) : null}
			</div>

			<div aria-live="polite" className="mb-4">
				{feedbackMessage ? (
					<Alert className="border-gray-700 bg-[var(--color-carbon)] text-[var(--color-photon)]">
						<AlertTitle>Estado</AlertTitle>
						<AlertDescription>{feedbackMessage}</AlertDescription>
					</Alert>
				) : null}
			</div>

			<div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
				<Card className="border-gray-800 bg-[var(--color-carbon)] shadow-none">
					<CardHeader className="border-b border-gray-800 pb-4">
						<CardTitle className="text-base">Mesas</CardTitle>
					</CardHeader>
					<CardContent className="space-y-5 pt-5">
						{bootstrap?.areas.map((area) => (
							<section key={area.id}>
								<h2 className="mb-2 text-sm font-medium text-gray-300">
									{area.name}
								</h2>
								<div className="space-y-2">
									{area.tables.map((table) => {
										const isSelected = table.id === resolvedSelectedTableId;
										return (
											<button
												key={table.id}
												type="button"
												onClick={() => handleSelectTable(table.id)}
												className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
													isSelected
														? "border-[var(--color-voltage)] bg-black/20 text-white"
														: "border-gray-800 bg-black/10 text-gray-200 hover:border-gray-700 hover:bg-black/20"
												}`}
											>
												<div className="flex items-center justify-between gap-3">
													<div className="min-w-0">
														<div className="truncate font-medium">
															{table.name}
														</div>
														<div className="mt-1 text-xs text-gray-400">
															{table.seats > 0
																? `${table.seats} puestos`
																: "Sin capacidad definida"}
														</div>
													</div>
													<div className="text-right text-xs text-gray-400">
														{table.openOrder ? (
															<>
																<div>
																	Orden #{table.openOrder.orderNumber}
																</div>
																<div>
																	{formatCurrency(
																		table.openOrder.totalAmount,
																	)}
																</div>
															</>
														) : (
															<div>Libre</div>
														)}
													</div>
												</div>
											</button>
										);
									})}
								</div>
							</section>
						))}
					</CardContent>
				</Card>

				<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
					<Card className="border-gray-800 bg-[var(--color-carbon)] shadow-none">
						<CardHeader className="border-b border-gray-800 pb-4">
							<CardTitle className="text-base">
								{selectedTable
									? `${selectedTable.name} · ${selectedTable.areaName}`
									: "Selecciona una mesa"}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6 pt-5">
							{selectedTable ? (
								<>
									<div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)_auto]">
										<div className="grid gap-2">
											<Label htmlFor="guestCount">Comensales</Label>
											<Input
												id="guestCount"
												name="guestCount"
												type="number"
												min={0}
												value={guestCountInput}
												onChange={(event) =>
													setGuestCountInput(event.target.value)
												}
												autoComplete="off"
												className="border-gray-700 bg-black/20"
											/>
										</div>
										<div className="grid gap-2">
											<Label htmlFor="orderNotes">Notas de la cuenta</Label>
											<Textarea
												id="orderNotes"
												name="orderNotes"
												value={orderNotes}
												onChange={(event) =>
													setOrderNotes(event.target.value)
												}
												autoComplete="off"
												className="min-h-20 border-gray-700 bg-black/20"
											/>
										</div>
										<div className="flex items-end">
											<Button
												type="button"
												onClick={handleSaveOrderMeta}
												disabled={
													!openOrder || updateOrderMetaMutation.isPending
												}
												className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
											>
												{updateOrderMetaMutation.isPending
													? "Guardando…"
													: "Guardar"}
											</Button>
										</div>
									</div>

									<section>
										<div className="mb-3 flex flex-wrap items-end gap-3">
											<div className="grid min-w-[220px] flex-1 gap-2">
												<Label htmlFor="restaurantSearch">
													Buscar producto
												</Label>
												<Input
													id="restaurantSearch"
													name="restaurantSearch"
													value={searchQuery}
													onChange={(event) =>
														setSearchQuery(event.target.value)
													}
													placeholder="Nombre, SKU o código…"
													autoComplete="off"
													className="border-gray-700 bg-black/20"
												/>
											</div>
											<div className="grid gap-2">
												<Label htmlFor="restaurantCategory">
													Categoría
												</Label>
												<NativeSelect
													id="restaurantCategory"
													name="restaurantCategory"
													value={activeCategoryId}
													onChange={(event) =>
														setActiveCategoryId(event.target.value)
													}
													className="w-[180px]"
												>
													<NativeSelectOption value="all">
														Todas
													</NativeSelectOption>
													{bootstrap?.categories.map((category) => (
														<NativeSelectOption
															key={category.id}
															value={category.id}
														>
															{category.name}
														</NativeSelectOption>
													))}
													</NativeSelect>
												</div>
										</div>

										<div className="rounded-lg border border-gray-800">
											<div className="grid grid-cols-[minmax(0,1fr)_140px_88px] border-b border-gray-800 px-3 py-2 text-sm text-gray-400">
												<div>Producto</div>
												<div>Precio</div>
												<div />
											</div>
											{products.length > 0 ? (
												products.map((product) => (
													<div
														key={product.id}
														className="grid grid-cols-[minmax(0,1fr)_140px_88px] items-center border-b border-gray-800 px-3 py-2 last:border-b-0"
													>
														<div className="min-w-0">
															<div className="truncate">
																{product.name}
															</div>
															<div className="mt-1 text-xs text-gray-400">
																{product.categoryName}
															</div>
														</div>
														<div className="text-sm text-gray-200">
															{formatCurrency(product.price)}
														</div>
														<div className="flex justify-end">
															<Button
																type="button"
																variant="outline"
																onClick={() =>
																	handleAddProduct(product.id)
																}
																disabled={addItemMutation.isPending}
																className="border-gray-700 bg-transparent text-gray-100 hover:bg-white/5"
															>
																Agregar
															</Button>
														</div>
													</div>
												))
											) : (
												<div className="px-3 py-6 text-sm text-gray-400">
													No hay productos para ese filtro.
												</div>
											)}
										</div>
									</section>
								</>
							) : (
								<div className="text-sm text-gray-400">
									Selecciona una mesa para comenzar.
								</div>
							)}
						</CardContent>
					</Card>

					<Card className="border-gray-800 bg-[var(--color-carbon)] shadow-none">
						<CardHeader className="border-b border-gray-800 pb-4">
							<CardTitle className="text-base">Cuenta</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4 pt-5">
							{openOrder ? (
								<>
									<div className="text-sm text-gray-400">
										Orden #{openOrder.orderNumber}
									</div>
									<div className="space-y-3">
										{openOrder.items.length > 0 ? (
											openOrder.items.map((item) => (
												<div
													key={item.id}
													className="rounded-lg border border-gray-800 bg-black/10 p-3"
												>
													<div className="flex items-start justify-between gap-3">
														<div className="min-w-0">
															<div className="truncate font-medium">
																{item.quantity} × {item.productName}
															</div>
															<div className="mt-1 text-sm text-gray-400">
																{formatCurrency(item.totalAmount)}
															</div>
															{item.modifiers.length > 0 ? (
																<div className="mt-2 text-xs text-gray-400">
																	{item.modifiers
																		.map((modifier) => modifier.name)
																		.join(", ")}
																</div>
															) : null}
														</div>
														<div className="text-xs text-gray-400">
															{item.status === "draft"
																? "Pendiente"
																: item.status === "sent"
																	? "En cocina"
																	: item.status === "ready"
																		? "Listo"
																		: "Servido"}
														</div>
													</div>

													<div className="mt-3 flex flex-wrap gap-2">
														{item.status === "draft" ? (
															<>
																<Button
																	type="button"
																	variant="outline"
																	onClick={() =>
																		handleUpdateDraftQuantity(
																			item.id,
																			item.quantity - 1,
																		)
																	}
																	disabled={
																		item.quantity <= 1 ||
																		updateDraftItemMutation.isPending
																	}
																	className="border-gray-700 bg-transparent text-gray-100 hover:bg-white/5"
																>
																	-
																</Button>
																<Button
																	type="button"
																	variant="outline"
																	onClick={() =>
																		handleUpdateDraftQuantity(
																			item.id,
																			item.quantity + 1,
																		)
																	}
																	disabled={
																		updateDraftItemMutation.isPending
																	}
																	className="border-gray-700 bg-transparent text-gray-100 hover:bg-white/5"
																>
																	+
																</Button>
																<Button
																	type="button"
																	variant="outline"
																	onClick={() =>
																		handleDeleteDraftItem(item.id)
																	}
																	disabled={
																		deleteDraftItemMutation.isPending
																	}
																	className="border-gray-700 bg-transparent text-gray-100 hover:bg-white/5"
																>
																	Quitar
																</Button>
														</>
													) : item.status !== "served" ? (
														<Button
															type="button"
															variant="outline"
															onClick={() =>
																handleMarkItemServed(item.id)
															}
															disabled={
																updateItemStatusMutation.isPending
															}
															className="border-gray-700 bg-transparent text-gray-100 hover:bg-white/5"
														>
															Marcar Servido
														</Button>
													) : null}
													</div>
												</div>
											))
										) : (
											<div className="text-sm text-gray-400">
												Agrega productos para abrir la cuenta.
											</div>
										)}
									</div>

									<div className="rounded-lg border border-gray-800 bg-black/10 p-3">
										<div className="flex items-center justify-between text-sm">
											<span className="text-gray-400">Total</span>
											<span className="font-medium text-white">
												{formatCurrency(openOrder.totals.totalAmount)}
											</span>
										</div>
										<div className="mt-1 flex items-center justify-between text-sm">
											<span className="text-gray-400">Items</span>
											<span className="text-gray-200">
												{openOrder.totals.itemCount}
											</span>
										</div>
									</div>

									<div className="flex gap-2">
										<Button
											type="button"
											variant="outline"
											onClick={handleSendToKitchen}
											disabled={
												sendToKitchenMutation.isPending ||
												openOrder.totals.draftItemsCount === 0
											}
											className="border-gray-700 bg-transparent text-gray-100 hover:bg-white/5"
										>
											{sendToKitchenMutation.isPending
												? "Enviando…"
												: "Enviar a Cocina"}
										</Button>
									</div>

									{bootstrap?.activeShift ? (
										<div className="space-y-3 rounded-lg border border-gray-800 bg-black/10 p-3">
											<div className="grid gap-3">
												<div className="grid gap-2">
													<Label htmlFor="paymentMethod">
														Método de pago
													</Label>
													<NativeSelect
														id="paymentMethod"
														name="paymentMethod"
														value={paymentMethod}
														onChange={(event) =>
															setPaymentMethod(
																	event.target.value,
																)
															}
													>
														{bootstrap.settings.paymentMethods.map(
															(method) => (
																<NativeSelectOption
																	key={method.id}
																	value={method.id}
																>
																	{method.label}
																</NativeSelectOption>
															),
														)}
													</NativeSelect>
												</div>
												<div className="grid gap-2">
													<Label htmlFor="paymentReference">
														Referencia
													</Label>
													<Input
														id="paymentReference"
														name="paymentReference"
														value={paymentReference}
														onChange={(event) =>
															setPaymentReference(
																event.target.value,
																)
															}
														placeholder="Voucher, transferencia…"
														autoComplete="off"
														className="border-gray-700 bg-black/20"
													/>
												</div>
											</div>
											<Button
												type="button"
												onClick={handleCloseOrder}
												disabled={
													closeOrderMutation.isPending ||
													(requiresReference &&
														paymentReference.trim().length === 0)
												}
												className="w-full bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
											>
												{closeOrderMutation.isPending
													? "Cobrando…"
													: "Cobrar Mesa"}
											</Button>
										</div>
									) : (
										<Alert className="border-gray-700 bg-black/10 text-[var(--color-photon)]">
											<AlertTitle>Caja requerida</AlertTitle>
											<AlertDescription>
												Abre una caja en POS para poder cobrar la mesa.
											</AlertDescription>
										</Alert>
									)}
								</>
							) : (
								<div className="text-sm text-gray-400">
									La mesa está libre. Agrega productos para crear la cuenta.
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</main>
	);
}
