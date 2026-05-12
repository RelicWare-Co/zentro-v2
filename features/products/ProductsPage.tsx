import {
	Check,
	ChevronsUpDown,
	Edit3,
	Loader2,
	Package,
	PackagePlus,
	Plus,
	Search,
	Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import {
	useReactTable,
	getCoreRowModel,
	getPaginationRowModel,
	flexRender,
	createColumnHelper,
	type PaginationState,
} from "@tanstack/react-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	useProductsMutations,
	useProductsQueries,
	type Category,
	type Product,
} from "@/features/products/hooks/use-products";
import { formatMoneyInput, parseMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

const ALL_FILTER_VALUE = "all";
const UNCATEGORIZED_FILTER_VALUE = "uncategorized";

const currencyFormatter = new Intl.NumberFormat("es-CO", {
	style: "currency",
	currency: "COP",
	maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
	day: "numeric",
	month: "short",
	year: "numeric",
});

type ProductFormState = {
	name: string;
	categoryId: string;
	sku: string;
	barcode: string;
	price: string;
	cost: string;
	taxRate: string;
	stock: string;
	trackInventory: boolean;
	isModifier: boolean;
};

const EMPTY_PRODUCT_FORM: ProductFormState = {
	name: "",
	categoryId: "",
	sku: "",
	barcode: "",
	price: "",
	cost: "0",
	taxRate: "0",
	stock: "0",
	trackInventory: true,
	isModifier: false,
};

function getErrorMessage(error: unknown, fallback: string) {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return fallback;
}

function getProductFormInitialValue(product: Product | null): ProductFormState {
	if (!product) {
		return EMPTY_PRODUCT_FORM;
	}

	return {
		name: product.name,
		categoryId: product.categoryId ?? "",
		sku: product.sku ?? "",
		barcode: product.barcode ?? "",
		price: String(product.price),
		cost: String(product.cost ?? 0),
		taxRate: String(product.taxRate ?? 0),
		stock: String(product.stock ?? 0),
		trackInventory: product.trackInventory,
		isModifier: product.isModifier,
	};
}

function normalizeSearchTerm(value: string) {
	return value.trim().toLowerCase();
}

export function ProductsPage() {
	const [activeTab, setActiveTab] = useState("products");
	const [query, setQuery] = useState("");
	const [categoryFilter, setCategoryFilter] = useState(ALL_FILTER_VALUE);
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 20,
	});
	const [isSheetOpen, setIsSheetOpen] = useState(false);
	const [editingProduct, setEditingProduct] = useState<Product | null>(null);
	const [productToDelete, setProductToDelete] = useState<Product | null>(null);
	const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
	const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
	const [inventoryProduct, setInventoryProduct] = useState<Product | null>(null);
	const [inventoryType, setInventoryType] = useState<
		"restock" | "waste" | "adjustment"
	>("restock");
	const [inventoryQuantity, setInventoryQuantity] = useState("");
	const [inventoryNotes, setInventoryNotes] = useState("");

	const {
		createProductMutation,
		updateProductMutation,
		deleteProductMutation,
		registerInventoryMovementMutation,
		createCategoryMutation,
		updateCategoryMutation,
		deleteCategoryMutation,
	} = useProductsMutations({
		onCreateProductSuccess: () => {
			setIsSheetOpen(false);
			setEditingProduct(null);
		},
		onUpdateProductSuccess: () => {
			setIsSheetOpen(false);
			setEditingProduct(null);
		},
		onDeleteProductSuccess: () => setProductToDelete(null),
		onCreateCategorySuccess: () => {
			setIsCategoryDialogOpen(false);
			setSelectedCategory(null);
		},
		onUpdateCategorySuccess: () => {
			setIsCategoryDialogOpen(false);
			setSelectedCategory(null);
		},
		onDeleteCategorySuccess: () => {
			setIsCategoryDialogOpen(false);
			setSelectedCategory(null);
		},
		onRegisterInventoryMovementSuccess: () => {
			setInventoryProduct(null);
			setInventoryQuantity("");
			setInventoryNotes("");
			setInventoryType("restock");
		},
	});

	const resolvedCategoryId =
		categoryFilter === ALL_FILTER_VALUE
			? null
			: categoryFilter === UNCATEGORIZED_FILTER_VALUE
				? "uncategorized"
				: categoryFilter;

	const { products, total, categories, isPending, isError, error } =
		useProductsQueries({
			page: pagination.pageIndex,
			pageSize: pagination.pageSize,
			query: query,
			categoryId: resolvedCategoryId,
		});

	const productsWithInventory = useMemo(
		() => products.filter((product) => product.trackInventory),
		[products],
	);

	const openCreateProduct = () => {
		setEditingProduct(null);
		setIsSheetOpen(true);
	};

	const openEditProduct = (product: Product) => {
		setEditingProduct(product);
		setIsSheetOpen(true);
	};

	const columnHelper = createColumnHelper<Product>();

	const columns = useMemo(
		() => [
			columnHelper.accessor("name", {
				header: "Producto",
				cell: ({ row }) => (
					<div className="min-w-0">
						<p className="truncate font-medium text-white">{row.original.name}</p>
						{row.original.isModifier ? (
							<Badge className="mt-1 border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)]">
								Modificador
							</Badge>
						) : null}
					</div>
				),
			}),
			columnHelper.accessor("categoryName", {
				header: "Categoría",
				cell: ({ getValue }) => getValue() ?? "Sin categoría",
			}),
			columnHelper.display({
				id: "sku",
				header: "SKU / Código",
				cell: ({ row }) => (
					<div className="text-sm text-gray-300">
						<p>{row.original.sku || "-"}</p>
						{row.original.barcode ? (
							<p className="text-xs text-gray-500">BC: {row.original.barcode}</p>
						) : null}
					</div>
				),
			}),
			columnHelper.display({
				id: "stock",
				header: "Stock",
				cell: ({ row }) => <StockBadge product={row.original} />,
			}),
			columnHelper.accessor("price", {
				header: "Precio",
				cell: ({ getValue }) => (
					<span className="font-medium text-gray-200">
						{currencyFormatter.format(getValue())}
					</span>
				),
			}),
			columnHelper.display({
				id: "actions",
				header: () => <span className="sr-only">Acciones</span>,
				cell: ({ row }) => (
					<div className="flex justify-end gap-2">
						{row.original.trackInventory ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setInventoryProduct(row.original)}
								className="border-gray-700 bg-transparent text-gray-200 hover:bg-white/5"
							>
								Stock
							</Button>
						) : null}
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => openEditProduct(row.original)}
							className="border-gray-700 bg-transparent text-gray-200 hover:bg-white/5"
						>
							<Edit3 className="h-3.5 w-3.5" />
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setProductToDelete(row.original)}
							className="border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
						>
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
					</div>
				),
			}),
		],
		[],
	);

	useEffect(() => {
		setPagination((prev) => ({ ...prev, pageIndex: 0 }));
	}, [query, categoryFilter]);

	const table = useReactTable({
		data: products,
		columns,
		getCoreRowModel: getCoreRowModel(),
		manualPagination: true,
		rowCount: total,
		onPaginationChange: setPagination,
		state: {
			pagination,
		},
	});

	const productFormError =
		createProductMutation.error ?? updateProductMutation.error;
	const categoryError =
		createCategoryMutation.error ??
		updateCategoryMutation.error ??
		deleteCategoryMutation.error;

	if (isPending) {
		return (
			<div className="flex min-h-[60dvh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-[var(--color-voltage)]" />
			</div>
		);
	}

	if (isError) {
		return (
			<div className="mx-auto max-w-3xl p-6 md:p-8">
				<Alert
					variant="destructive"
					className="border-red-500/20 bg-red-500/10 text-red-100"
				>
					<AlertTitle>No se pudo cargar inventario</AlertTitle>
					<AlertDescription>
						{getErrorMessage(error, "Intenta recargar la página.")}
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	return (
		<main className="space-y-6 bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12">
			<section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
				<div className="space-y-2">
					<div className="flex items-center gap-3">
						<h1 className="text-3xl font-bold tracking-tight">Inventario</h1>
						<Badge className="border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/10">
							{total} productos
						</Badge>
					</div>
					<p className="text-sm text-gray-400">
						Catálogo de productos, categorías y ajustes básicos de stock.
					</p>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row">
					<Button
						type="button"
						variant="outline"
						onClick={() => setInventoryProduct(products.find((p) => p.trackInventory) ?? null)}
						disabled={!products.some((product) => product.trackInventory)}
						className="border-gray-800 bg-[var(--color-carbon)] text-gray-300 hover:bg-white/5 hover:text-white"
					>
						<PackagePlus className="h-4 w-4" />
						Movimiento de stock
					</Button>
					<Button
						type="button"
						onClick={openCreateProduct}
						className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
					>
						<Plus className="h-4 w-4" />
						Agregar producto
					</Button>
				</div>
			</section>

			<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
				<TabsList className="flex w-full h-auto flex-wrap gap-2 bg-transparent border-0 p-0">
					<TabsTrigger
						value="products"
						className="flex-1 sm:flex-none h-10 gap-2 rounded-xl border border-transparent px-5 text-sm font-medium text-gray-400 transition-all hover:text-white data-[state=active]:bg-[var(--color-carbon)] data-[state=active]:!border-gray-700 data-[state=active]:text-white"
					>
						<Package className="h-4 w-4" />
						Productos
					</TabsTrigger>
					<TabsTrigger
						value="categories"
						className="flex-1 sm:flex-none h-10 gap-2 rounded-xl border border-transparent px-5 text-sm font-medium text-gray-400 transition-all hover:text-white data-[state=active]:bg-[var(--color-carbon)] data-[state=active]:!border-gray-700 data-[state=active]:text-white"
					>
						Categorías
					</TabsTrigger>
				</TabsList>

				<TabsContent value="products" className="space-y-6">
					<div className="flex flex-col gap-3 sm:flex-row">
						<div className="relative w-full sm:max-w-sm">
							<Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-500" />
							<Input
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Buscar por nombre, SKU o código..."
								className="border-gray-800 bg-black/20 pl-9"
							/>
						</div>
						<Select value={categoryFilter} onValueChange={setCategoryFilter}>
							<SelectTrigger className="w-full border-gray-800 bg-black/20 text-white sm:w-[240px]">
								<SelectValue placeholder="Todas las categorías" />
							</SelectTrigger>
							<SelectContent className="border-gray-800 bg-[var(--color-carbon)] text-white">
								<SelectItem value={ALL_FILTER_VALUE}>
									Todas las categorías
								</SelectItem>
								<SelectItem value={UNCATEGORIZED_FILTER_VALUE}>
									Sin categoría
								</SelectItem>
								{categories.map((category) => (
									<SelectItem key={category.id} value={category.id}>
										{category.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-4">
						<div className="rounded-xl border border-gray-800 bg-[var(--color-carbon)] overflow-hidden">
							<div className="max-h-[600px] overflow-auto">
								<Table>
									<TableHeader className="sticky top-0 z-10 bg-[var(--color-carbon)]">
										{table.getHeaderGroups().map((headerGroup) => (
											<TableRow key={headerGroup.id} className="border-gray-800 hover:bg-transparent">
												{headerGroup.headers.map((header) => (
													<TableHead key={header.id} className="px-4 text-gray-400">
														{header.isPlaceholder
															? null
															: flexRender(header.column.columnDef.header, header.getContext())}
													</TableHead>
												))}
											</TableRow>
										))}
									</TableHeader>
									<TableBody>
										{table.getRowModel().rows.length ? (
											table.getRowModel().rows.map((row) => (
												<TableRow key={row.id} className="border-gray-800 hover:bg-white/5">
													{row.getVisibleCells().map((cell) => (
														<TableCell key={cell.id} className="px-4">
															{flexRender(cell.column.columnDef.cell, cell.getContext())}
														</TableCell>
													))}
												</TableRow>
											))
										) : (
											<TableRow className="border-gray-800">
												<TableCell colSpan={columns.length} className="p-10 text-center text-sm text-gray-500">
													No hay productos que coincidan con los filtros.
												</TableCell>
											</TableRow>
										)}
									</TableBody>
								</Table>
							</div>
							<div className="border-t border-gray-800 p-2">
								<DataTablePagination table={table} />
							</div>
						</div>
					</div>
				</TabsContent>

				<TabsContent value="categories" className="space-y-6">
					<div className="flex justify-end">
						<Button
							type="button"
							onClick={() => {
								setSelectedCategory(null);
								setIsCategoryDialogOpen(true);
							}}
							className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
						>
							<Plus className="h-4 w-4" />
							Crear categoría
						</Button>
					</div>
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{categories.map((category) => (
							<button
								key={category.id}
								type="button"
								onClick={() => {
									setSelectedCategory(category);
									setIsCategoryDialogOpen(true);
								}}
								className="rounded-xl border border-gray-800 bg-[var(--color-carbon)] p-4 text-left transition-colors hover:border-[var(--color-voltage)]/40"
							>
								<p className="font-medium text-white">{category.name}</p>
								<p className="mt-2 line-clamp-2 text-sm text-gray-400">
									{category.description || "Sin descripción"}
								</p>
							</button>
						))}
					</div>
					{categories.length === 0 ? (
						<div className="rounded-xl border border-dashed border-gray-800 bg-black/10 p-10 text-center text-sm text-gray-500">
							Aún no hay categorías.
						</div>
					) : null}
				</TabsContent>
			</Tabs>

			<ProductFormSheet
				open={isSheetOpen}
				onOpenChange={(open) => {
					setIsSheetOpen(open);
					if (!open) setEditingProduct(null);
				}}
				product={editingProduct}
				categories={categories}
				isPending={
					createProductMutation.isPending || updateProductMutation.isPending
				}
				error={productFormError}
				onSave={async (payload) => {
					if (payload.id) {
						await updateProductMutation.mutateAsync({
							...payload,
							id: payload.id,
						});
					} else {
						await createProductMutation.mutateAsync(payload);
					}
				}}
				onOpenCategoryDialog={() => {
					setSelectedCategory(null);
					setIsCategoryDialogOpen(true);
				}}
			/>

			<CategoryDialog
				open={isCategoryDialogOpen}
				onOpenChange={(open) => {
					setIsCategoryDialogOpen(open);
					if (!open) setSelectedCategory(null);
				}}
				category={selectedCategory}
				error={categoryError}
				isPending={
					createCategoryMutation.isPending ||
					updateCategoryMutation.isPending ||
					deleteCategoryMutation.isPending
				}
				onSave={async (payload) => {
					if (selectedCategory) {
						await updateCategoryMutation.mutateAsync({
							id: selectedCategory.id,
							...payload,
						});
					} else {
						await createCategoryMutation.mutateAsync(payload);
					}
				}}
				onDelete={
					selectedCategory
						? () =>
								deleteCategoryMutation.mutateAsync({
									id: selectedCategory.id,
								})
						: undefined
				}
			/>

			<InventoryDialog
				product={inventoryProduct}
				products={productsWithInventory}
				type={inventoryType}
				quantity={inventoryQuantity}
				notes={inventoryNotes}
				isPending={registerInventoryMovementMutation.isPending}
				error={registerInventoryMovementMutation.error}
				onProductChange={setInventoryProduct}
				onTypeChange={setInventoryType}
				onQuantityChange={setInventoryQuantity}
				onNotesChange={setInventoryNotes}
				onOpenChange={(open) => {
					if (!open) {
						setInventoryProduct(null);
						setInventoryQuantity("");
						setInventoryNotes("");
						setInventoryType("restock");
					}
				}}
				onSave={async () => {
					if (!inventoryProduct) return;
					await registerInventoryMovementMutation.mutateAsync({
						productId: inventoryProduct.id,
						type: inventoryType,
						quantity: Math.round(Number(inventoryQuantity)),
						notes: inventoryNotes.trim() || null,
					});
				}}
			/>

			<AlertDialog
				open={Boolean(productToDelete)}
				onOpenChange={(open) => {
					if (!open) setProductToDelete(null);
				}}
			>
				<AlertDialogContent className="border-gray-800 bg-[var(--color-carbon)] text-white">
					<AlertDialogHeader>
						<AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
						<AlertDialogDescription className="text-gray-400">
							{productToDelete?.name} será removido del catálogo activo.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="border-gray-700 bg-transparent text-gray-200 hover:bg-white/5">
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (productToDelete) {
									void deleteProductMutation.mutateAsync({
										id: productToDelete.id,
									});
								}
							}}
							className="bg-red-500 text-white hover:bg-red-600"
						>
							{deleteProductMutation.isPending ? "Eliminando..." : "Eliminar"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</main>
	);
}

function StockBadge({ product }: { product: Product }) {
	if (!product.trackInventory) {
		return (
			<span className="text-xs font-medium tracking-wider text-gray-500 uppercase">
				Sin seguimiento
			</span>
		);
	}

	const className =
		product.stock <= 0
			? "border-red-500/20 bg-red-500/10 text-red-300"
			: product.stock < 10
				? "border-amber-500/20 bg-amber-500/10 text-amber-300"
				: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";

	return (
		<div className="flex items-center gap-2">
			<span className="font-medium text-gray-200">{product.stock}</span>
			<Badge variant="outline" className={className}>
				{product.stock <= 0
					? "Sin stock"
					: product.stock < 10
						? "Stock bajo"
						: "En stock"}
			</Badge>
		</div>
	);
}

function ProductFormSheet({
	open,
	onOpenChange,
	product,
	categories,
	isPending,
	error,
	onSave,
	onOpenCategoryDialog,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	product: Product | null;
	categories: Category[];
	isPending: boolean;
	error: unknown;
	onSave: (payload: {
		id?: string;
		name: string;
		categoryId: string | null;
		sku: string | null;
		barcode: string | null;
		price: number;
		cost: number;
		taxRate: number;
		stock: number;
		trackInventory: boolean;
		isModifier: boolean;
	}) => Promise<void>;
	onOpenCategoryDialog: () => void;
}) {
	return (
		<ProductFormSheetContent
			key={open ? (product?.id ?? "new") : "closed"}
			open={open}
			onOpenChange={onOpenChange}
			product={product}
			categories={categories}
			isPending={isPending}
			error={error}
			onSave={onSave}
			onOpenCategoryDialog={onOpenCategoryDialog}
		/>
	);
}

function ProductFormSheetContent({
	open,
	onOpenChange,
	product,
	categories,
	isPending,
	error,
	onSave,
	onOpenCategoryDialog,
}: Parameters<typeof ProductFormSheet>[0]) {
	const [form, setForm] = useState(() => getProductFormInitialValue(product));

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		await onSave({
			...(product ? { id: product.id } : {}),
			name: form.name,
			categoryId: form.categoryId || null,
			sku: form.sku || null,
			barcode: form.barcode || null,
			price: parseMoneyInput(form.price),
			cost: parseMoneyInput(form.cost),
			taxRate: Number(form.taxRate) || 0,
			stock: Number(form.stock) || 0,
			trackInventory: form.trackInventory,
			isModifier: form.isModifier,
		});
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="!w-full !max-w-full overflow-hidden border-l border-gray-800 bg-[var(--color-carbon)] p-0 text-white sm:!w-[780px]">
				<form onSubmit={handleSubmit} className="flex h-full flex-col">
					<SheetHeader className="shrink-0 border-b border-gray-800 p-6">
						<SheetTitle className="text-2xl font-bold">
							{product ? "Editar producto" : "Crear producto"}
						</SheetTitle>
						<SheetDescription className="text-gray-400">
							Datos de venta, inventario y clasificación.
						</SheetDescription>
					</SheetHeader>

					<div className="flex-1 space-y-6 overflow-y-auto p-6">
						<div className="grid gap-4 md:grid-cols-2">
							<Field label="Nombre" required>
								<Input
									value={form.name}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											name: event.target.value,
										}))
									}
									className="border-gray-700 bg-black/20"
									required
								/>
							</Field>
							<Field label="Categoría">
								<Select
									value={form.categoryId || "none"}
									onValueChange={(value) => {
										if (value === "add") {
											onOpenCategoryDialog();
											return;
										}
										setForm((current) => ({
											...current,
											categoryId: value === "none" ? "" : value,
										}));
									}}
								>
									<SelectTrigger className="w-full border-gray-700 bg-black/20 text-white">
										<SelectValue placeholder="Sin categoría" />
									</SelectTrigger>
									<SelectContent className="border-gray-800 bg-[var(--color-carbon)] text-white">
										<SelectItem value="none">Sin categoría</SelectItem>
										{categories.map((category) => (
											<SelectItem key={category.id} value={category.id}>
												{category.name}
											</SelectItem>
										))}
										<SelectItem value="add">Agregar categoría</SelectItem>
									</SelectContent>
								</Select>
							</Field>
							<Field label="SKU">
								<Input
									value={form.sku}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											sku: event.target.value,
										}))
									}
									className="border-gray-700 bg-black/20"
								/>
							</Field>
							<Field label="Código de barras">
								<Input
									value={form.barcode}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											barcode: event.target.value,
										}))
									}
									className="border-gray-700 bg-black/20"
								/>
							</Field>
							<Field label="Precio unitario" required>
								<Input
									type="text"
									inputMode="numeric"
									value={formatMoneyInput(form.price)}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											price: sanitizeMoneyInput(event.target.value),
										}))
									}
									className="border-gray-700 bg-black/20"
									required
								/>
							</Field>
							<Field label="Costo">
								<Input
									type="text"
									inputMode="numeric"
									value={formatMoneyInput(form.cost)}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											cost: sanitizeMoneyInput(event.target.value),
										}))
									}
									className="border-gray-700 bg-black/20"
								/>
							</Field>
							<Field label="Impuesto (%)">
								<Input
									type="number"
									min={0}
									max={100}
									value={form.taxRate}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											taxRate: event.target.value,
										}))
									}
									className="border-gray-700 bg-black/20"
								/>
							</Field>
							{form.trackInventory ? (
								<Field label="Stock inicial">
									<Input
										type="number"
										min={0}
										value={form.stock}
										onChange={(event) =>
											setForm((current) => ({
												...current,
												stock: event.target.value,
											}))
										}
										className="border-gray-700 bg-black/20"
									/>
								</Field>
							) : null}
						</div>

						<div className="grid gap-3 md:grid-cols-2">
							<ToggleLine
								title="Controlar inventario"
								description="Actualiza stock y movimientos."
								checked={form.trackInventory}
								onCheckedChange={(checked) =>
									setForm((current) => ({
										...current,
										trackInventory: checked,
									}))
								}
							/>
							<ToggleLine
								title="Es modificador"
								description="Se usa como adicional en POS."
								checked={form.isModifier}
								onCheckedChange={(checked) =>
									setForm((current) => ({
										...current,
										isModifier: checked,
									}))
								}
							/>
						</div>

						{error ? (
							<p className="rounded-md border border-red-400/20 bg-red-400/10 p-3 text-sm font-medium text-red-300">
								{getErrorMessage(error, "No se pudo guardar el producto.")}
							</p>
						) : null}
					</div>

					<SheetFooter className="shrink-0 border-t border-gray-800 bg-black/30 p-6">
						<Button
							type="submit"
							disabled={isPending}
							className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
						>
							{isPending ? "Guardando..." : "Guardar producto"}
						</Button>
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	);
}

function Field({
	label,
	required,
	children,
}: {
	label: string;
	required?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2">
			<Label>
				{label}
				{required ? <span className="text-red-400"> *</span> : null}
			</Label>
			{children}
		</div>
	);
}

function ToggleLine({
	title,
	description,
	checked,
	onCheckedChange,
}: {
	title: string;
	description: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-black/20 p-4">
			<div>
				<p className="font-medium text-white">{title}</p>
				<p className="text-sm text-gray-400">{description}</p>
			</div>
			<Switch checked={checked} onCheckedChange={onCheckedChange} />
		</div>
	);
}

function CategoryDialog({
	open,
	onOpenChange,
	category,
	error,
	isPending,
	onSave,
	onDelete,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	category: Category | null;
	error: unknown;
	isPending: boolean;
	onSave: (payload: { name: string; description: string | null }) => Promise<void>;
	onDelete?: () => Promise<unknown>;
}) {
	return (
		<CategoryDialogContent
			key={open ? (category?.id ?? "new") : "closed"}
			open={open}
			onOpenChange={onOpenChange}
			category={category}
			error={error}
			isPending={isPending}
			onSave={onSave}
			onDelete={onDelete}
		/>
	);
}

function CategoryDialogContent({
	open,
	onOpenChange,
	category,
	error,
	isPending,
	onSave,
	onDelete,
}: Parameters<typeof CategoryDialog>[0]) {
	const [name, setName] = useState(category?.name ?? "");
	const [description, setDescription] = useState(category?.description ?? "");

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="border-gray-800 bg-[var(--color-carbon)] text-white sm:max-w-[480px]">
				<DialogHeader>
					<DialogTitle>
						{category ? "Editar categoría" : "Crear categoría"}
					</DialogTitle>
				</DialogHeader>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void onSave({
							name,
							description: description || null,
						});
					}}
					className="space-y-4"
				>
					<Field label="Nombre" required>
						<Input
							value={name}
							onChange={(event) => setName(event.target.value)}
							className="border-gray-700 bg-black/20"
							required
						/>
					</Field>
					<Field label="Descripción">
						<Textarea
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							className="min-h-[80px] border-gray-700 bg-black/20"
						/>
					</Field>
					{error ? (
						<p className="text-sm text-red-400">
							{getErrorMessage(error, "No se pudo guardar la categoría.")}
						</p>
					) : null}
					<DialogFooter className="gap-2 sm:justify-between">
						{category && onDelete ? (
							<Button
								type="button"
								variant="outline"
								onClick={() => void onDelete()}
								disabled={isPending}
								className="border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
							>
								Eliminar
							</Button>
						) : (
							<span />
						)}
						<Button
							type="submit"
							disabled={isPending || !name.trim()}
							className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
						>
							{isPending ? "Guardando..." : "Guardar"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function InventoryDialog({
	product,
	products,
	type,
	quantity,
	notes,
	isPending,
	error,
	onProductChange,
	onTypeChange,
	onQuantityChange,
	onNotesChange,
	onOpenChange,
	onSave,
}: {
	product: Product | null;
	products: Product[];
	type: "restock" | "waste" | "adjustment";
	quantity: string;
	notes: string;
	isPending: boolean;
	error: unknown;
	onProductChange: (product: Product | null) => void;
	onTypeChange: (type: "restock" | "waste" | "adjustment") => void;
	onQuantityChange: (quantity: string) => void;
	onNotesChange: (notes: string) => void;
	onOpenChange: (open: boolean) => void;
	onSave: () => Promise<void>;
}) {
	const [productPickerOpen, setProductPickerOpen] = useState(false);
	const open = Boolean(product);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="border-gray-800 bg-[var(--color-carbon)] text-white sm:max-w-[520px]">
				<DialogHeader>
					<DialogTitle>Movimiento de stock</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<Field label="Producto">
						<Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
							<PopoverTrigger asChild>
								<Button
									type="button"
									variant="outline"
									role="combobox"
									aria-controls="inventory-product-picker-list"
									aria-expanded={productPickerOpen}
									className="w-full justify-between border-gray-700 bg-black/20 text-white hover:bg-white/5"
								>
									<span className="truncate">
										{product
											? `${product.name} (${product.stock})`
											: "Seleccionar producto..."}
									</span>
									<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-500" />
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-[min(360px,calc(100vw-2rem))] border-gray-800 bg-[var(--color-carbon)] p-0 text-white">
								<Command className="bg-transparent">
									<CommandInput
										placeholder="Buscar producto..."
										className="text-white placeholder:text-gray-500"
									/>
									<CommandList id="inventory-product-picker-list" className="p-1.5">
										<CommandEmpty className="text-gray-400">
											No se encontraron productos.
										</CommandEmpty>
										{products.map((item) => (
											<CommandItem
												key={item.id}
												value={`${item.name} ${item.id}`}
												onSelect={() => {
													onProductChange(item);
													setProductPickerOpen(false);
												}}
												className="gap-3 rounded-lg py-2 text-white"
											>
												<span className="truncate">
													{item.name} ({item.stock})
												</span>
												<Check
													className={cn(
														"ml-auto h-4 w-4 shrink-0",
														product?.id === item.id
															? "opacity-100"
															: "opacity-0",
													)}
												/>
											</CommandItem>
										))}
									</CommandList>
								</Command>
							</PopoverContent>
						</Popover>
					</Field>
					<Field label="Tipo">
						<Select value={type} onValueChange={onTypeChange}>
							<SelectTrigger className="w-full border-gray-700 bg-black/20 text-white">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="border-gray-800 bg-[var(--color-carbon)] text-white">
								<SelectItem value="restock">Reposición</SelectItem>
								<SelectItem value="waste">Merma</SelectItem>
								<SelectItem value="adjustment">Ajuste</SelectItem>
							</SelectContent>
						</Select>
					</Field>
					<Field label="Cantidad" required>
						<Input
							type="number"
							value={quantity}
							onChange={(event) => onQuantityChange(event.target.value)}
							className="border-gray-700 bg-black/20"
							required
						/>
					</Field>
					<Field label="Notas">
						<Textarea
							value={notes}
							onChange={(event) => onNotesChange(event.target.value)}
							className="min-h-[80px] border-gray-700 bg-black/20"
						/>
					</Field>
					{error ? (
						<p className="text-sm text-red-400">
							{getErrorMessage(error, "No se pudo registrar el movimiento.")}
						</p>
					) : null}
				</div>
				<DialogFooter>
					<Button
						type="button"
						onClick={() => void onSave()}
						disabled={
							isPending ||
							!product ||
							!Number.isFinite(Number(quantity)) ||
							Number(quantity) === 0
						}
						className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
					>
						{isPending ? "Guardando..." : "Registrar"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
