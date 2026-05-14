import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  type PaginationState,
  useReactTable,
} from "@tanstack/react-table";
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
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type Category,
  type Product,
  useProductsMutations,
  useProductsQueries,
} from "@/features/products/hooks/use-products";
import {
  cn,
  formatMoneyInput,
  parseMoneyInput,
  sanitizeMoneyInput,
} from "@/lib/utils";

const ALL_FILTER_VALUE = "all";
const UNCATEGORIZED_FILTER_VALUE = "uncategorized";

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

interface ProductFormState {
  barcode: string;
  categoryId: string;
  cost: string;
  isModifier: boolean;
  name: string;
  price: string;
  sku: string;
  stock: string;
  taxRate: string;
  trackInventory: boolean;
}

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
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [inventoryProduct, setInventoryProduct] = useState<Product | null>(
    null
  );
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

  let resolvedCategoryId: string | null;
  if (categoryFilter === ALL_FILTER_VALUE) {
    resolvedCategoryId = null;
  } else if (categoryFilter === UNCATEGORIZED_FILTER_VALUE) {
    resolvedCategoryId = "uncategorized";
  } else {
    resolvedCategoryId = categoryFilter;
  }

  const { products, total, categories, isPending, isError, error } =
    useProductsQueries({
      page: pagination.pageIndex,
      pageSize: pagination.pageSize,
      query,
      categoryId: resolvedCategoryId,
    });

  const productsWithInventory = useMemo(
    () => products.filter((product) => product.trackInventory),
    [products]
  );

  const openCreateProduct = () => {
    setEditingProduct(null);
    setIsSheetOpen(true);
  };

  const openEditProduct = useCallback((product: Product) => {
    setEditingProduct(product);
    setIsSheetOpen(true);
  }, []);

  const columnHelper = createColumnHelper<Product>();

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Producto",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-white">
              {row.original.name}
            </p>
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
          <div className="text-sm text-zinc-300">
            <p>{row.original.sku || "-"}</p>
            {row.original.barcode ? (
              <p className="text-xs text-zinc-500">
                BC: {row.original.barcode}
              </p>
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
          <span className="font-medium text-zinc-200">
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
                className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
                onClick={() => setInventoryProduct(row.original)}
                size="sm"
                type="button"
                variant="outline"
              >
                Stock
              </Button>
            ) : null}
            <Button
              className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
              onClick={() => openEditProduct(row.original)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Edit3 className="size-3.5" />
            </Button>
            <Button
              className="border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
              onClick={() => setProductToDelete(row.original)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
      }),
    ],
    [columnHelper.display, openEditProduct, columnHelper.accessor]
  );

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

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
        <Loader2 className="size-8 animate-spin text-[var(--color-voltage)]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl p-6 md:p-8">
        <Alert
          className="border-red-500/20 bg-red-500/10 text-red-100"
          variant="destructive"
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
            <h1 className="font-semibold text-3xl tracking-tight">
              Inventario
            </h1>
            <Badge className="border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/10">
              {total} productos
            </Badge>
          </div>
          <p className="text-sm text-zinc-400">
            Catálogo de productos, categorías y ajustes básicos de stock.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            className="border-zinc-800 bg-[var(--color-carbon)] text-zinc-300 hover:bg-white/5 hover:text-white"
            disabled={!products.some((product) => product.trackInventory)}
            onClick={() =>
              setInventoryProduct(
                products.find((p) => p.trackInventory) ?? null
              )
            }
            type="button"
            variant="outline"
          >
            <PackagePlus className="size-4" />
            Movimiento de stock
          </Button>
          <Button
            className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
            onClick={openCreateProduct}
            type="button"
          >
            <Plus className="size-4" />
            Agregar producto
          </Button>
        </div>
      </section>

      <Tabs
        className="space-y-6"
        onValueChange={setActiveTab}
        value={activeTab}
      >
        <TabsList className="flex h-auto w-full flex-wrap gap-2 border-0 bg-transparent p-0">
          <TabsTrigger
            className="data-[state=active]:!border-zinc-700 h-10 flex-1 gap-2 rounded-xl border border-transparent px-5 font-medium text-sm text-zinc-400 transition-all hover:text-white data-[state=active]:bg-[var(--color-carbon)] data-[state=active]:text-white sm:flex-none"
            value="products"
          >
            <Package className="size-4" />
            Productos
          </TabsTrigger>
          <TabsTrigger
            className="data-[state=active]:!border-zinc-700 h-10 flex-1 gap-2 rounded-xl border border-transparent px-5 font-medium text-sm text-zinc-400 transition-all hover:text-white data-[state=active]:bg-[var(--color-carbon)] data-[state=active]:text-white sm:flex-none"
            value="categories"
          >
            Categorías
          </TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-6" value="products">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
              <Input
                className="border-zinc-800 bg-black/20 pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre, SKU o código..."
                value={query}
              />
            </div>
            <Select onValueChange={setCategoryFilter} value={categoryFilter}>
              <SelectTrigger className="w-full border-zinc-800 bg-black/20 text-white sm:w-[240px]">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
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
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[var(--color-carbon)]">
              <div className="max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-[var(--color-carbon)]">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow
                        className="border-zinc-800 hover:bg-transparent"
                        key={headerGroup.id}
                      >
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            className="px-4 text-zinc-400"
                            key={header.id}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow
                          className="border-zinc-800 hover:bg-white/5"
                          key={row.id}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell className="px-4" key={cell.id}>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow className="border-zinc-800">
                        <TableCell
                          className="p-10 text-center text-sm text-zinc-500"
                          colSpan={columns.length}
                        >
                          No hay productos que coincidan con los filtros.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="border-zinc-800 border-t p-2">
                <DataTablePagination table={table} />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent className="space-y-6" value="categories">
          <div className="flex justify-end">
            <Button
              className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
              onClick={() => {
                setSelectedCategory(null);
                setIsCategoryDialogOpen(true);
              }}
              type="button"
            >
              <Plus className="size-4" />
              Crear categoría
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => (
              <button
                className="rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-4 text-left transition-colors hover:border-[var(--color-voltage)]/40"
                key={category.id}
                onClick={() => {
                  setSelectedCategory(category);
                  setIsCategoryDialogOpen(true);
                }}
                type="button"
              >
                <p className="font-medium text-white">{category.name}</p>
                <p className="mt-2 line-clamp-2 text-sm text-zinc-400">
                  {category.description || "Sin descripción"}
                </p>
              </button>
            ))}
          </div>
          {categories.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 border-dashed bg-black/10 p-10 text-center text-sm text-zinc-500">
              Aún no hay categorías.
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      <ProductFormSheet
        categories={categories}
        error={productFormError}
        isPending={
          createProductMutation.isPending || updateProductMutation.isPending
        }
        onOpenCategoryDialog={() => {
          setSelectedCategory(null);
          setIsCategoryDialogOpen(true);
        }}
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) {
            setEditingProduct(null);
          }
        }}
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
        open={isSheetOpen}
        product={editingProduct}
      />

      <CategoryDialog
        category={selectedCategory}
        error={categoryError}
        isPending={
          createCategoryMutation.isPending ||
          updateCategoryMutation.isPending ||
          deleteCategoryMutation.isPending
        }
        onDelete={
          selectedCategory
            ? () =>
                deleteCategoryMutation.mutateAsync({
                  id: selectedCategory.id,
                })
            : undefined
        }
        onOpenChange={(open) => {
          setIsCategoryDialogOpen(open);
          if (!open) {
            setSelectedCategory(null);
          }
        }}
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
        open={isCategoryDialogOpen}
      />

      <InventoryDialog
        error={registerInventoryMovementMutation.error}
        isPending={registerInventoryMovementMutation.isPending}
        notes={inventoryNotes}
        onNotesChange={setInventoryNotes}
        onOpenChange={(open) => {
          if (!open) {
            setInventoryProduct(null);
            setInventoryQuantity("");
            setInventoryNotes("");
            setInventoryType("restock");
          }
        }}
        onProductChange={setInventoryProduct}
        onQuantityChange={setInventoryQuantity}
        onSave={async () => {
          if (!inventoryProduct) {
            return;
          }
          await registerInventoryMovementMutation.mutateAsync({
            productId: inventoryProduct.id,
            type: inventoryType,
            quantity: Math.round(Number(inventoryQuantity)),
            notes: inventoryNotes.trim() || null,
          });
        }}
        onTypeChange={setInventoryType}
        product={inventoryProduct}
        products={productsWithInventory}
        quantity={inventoryQuantity}
        type={inventoryType}
      />

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setProductToDelete(null);
          }
        }}
        open={Boolean(productToDelete)}
      >
        <AlertDialogContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {productToDelete?.name} será removido del catálogo activo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={() => {
                if (productToDelete) {
                  deleteProductMutation
                    .mutateAsync({
                      id: productToDelete.id,
                    })
                    .catch(() => undefined);
                }
              }}
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
      <span className="font-medium text-xs text-zinc-500 uppercase tracking-wider">
        Sin seguimiento
      </span>
    );
  }

  let className: string;
  let stockLabel: string;
  if (product.stock <= 0) {
    className = "border-red-500/20 bg-red-500/10 text-red-300";
    stockLabel = "Sin stock";
  } else if (product.stock < 10) {
    className = "border-amber-500/20 bg-amber-500/10 text-amber-300";
    stockLabel = "Stock bajo";
  } else {
    className = "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    stockLabel = "En stock";
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-medium text-zinc-200">{product.stock}</span>
      <Badge className={className} variant="outline">
        {stockLabel}
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
      categories={categories}
      error={error}
      isPending={isPending}
      key={open ? (product?.id ?? "new") : "closed"}
      onOpenCategoryDialog={onOpenCategoryDialog}
      onOpenChange={onOpenChange}
      onSave={onSave}
      open={open}
      product={product}
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
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="!w-full !max-w-full sm:!w-[780px] overflow-hidden border-zinc-800 border-l bg-[var(--color-carbon)] p-0 text-white">
        <form className="flex h-full flex-col" onSubmit={handleSubmit}>
          <SheetHeader className="shrink-0 border-zinc-800 border-b p-6">
            <SheetTitle className="font-bold text-2xl">
              {product ? "Editar producto" : "Crear producto"}
            </SheetTitle>
            <SheetDescription className="text-zinc-400">
              Datos de venta, inventario y clasificación.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nombre" required>
                <Input
                  className="border-zinc-700 bg-black/20"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                  value={form.name}
                />
              </Field>
              <Field label="Categoría">
                <Select
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
                  value={form.categoryId || "none"}
                >
                  <SelectTrigger className="w-full border-zinc-700 bg-black/20 text-white">
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
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
                  className="border-zinc-700 bg-black/20"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sku: event.target.value,
                    }))
                  }
                  value={form.sku}
                />
              </Field>
              <Field label="Código de barras">
                <Input
                  className="border-zinc-700 bg-black/20"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      barcode: event.target.value,
                    }))
                  }
                  value={form.barcode}
                />
              </Field>
              <Field label="Precio unitario" required>
                <Input
                  className="border-zinc-700 bg-black/20"
                  inputMode="numeric"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      price: sanitizeMoneyInput(event.target.value),
                    }))
                  }
                  required
                  type="text"
                  value={formatMoneyInput(form.price)}
                />
              </Field>
              <Field label="Costo">
                <Input
                  className="border-zinc-700 bg-black/20"
                  inputMode="numeric"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      cost: sanitizeMoneyInput(event.target.value),
                    }))
                  }
                  type="text"
                  value={formatMoneyInput(form.cost)}
                />
              </Field>
              <Field label="Impuesto (%)">
                <Input
                  className="border-zinc-700 bg-black/20"
                  max={100}
                  min={0}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      taxRate: event.target.value,
                    }))
                  }
                  type="number"
                  value={form.taxRate}
                />
              </Field>
              {form.trackInventory ? (
                <Field label="Stock inicial">
                  <Input
                    className="border-zinc-700 bg-black/20"
                    min={0}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        stock: event.target.value,
                      }))
                    }
                    type="number"
                    value={form.stock}
                  />
                </Field>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <ToggleLine
                checked={form.trackInventory}
                description="Actualiza stock y movimientos."
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    trackInventory: checked,
                  }))
                }
                title="Controlar inventario"
              />
              <ToggleLine
                checked={form.isModifier}
                description="Se usa como adicional en POS."
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    isModifier: checked,
                  }))
                }
                title="Es modificador"
              />
            </div>

            {error ? (
              <p className="rounded-md border border-red-400/20 bg-red-400/10 p-3 font-medium text-red-300 text-sm">
                {getErrorMessage(error, "No se pudo guardar el producto.")}
              </p>
            ) : null}
          </div>

          <SheetFooter className="shrink-0 border-zinc-800 border-t bg-black/30 p-6">
            <Button
              className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
              disabled={isPending}
              type="submit"
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
    <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-black/20 p-4">
      <div>
        <p className="font-medium text-white">{title}</p>
        <p className="text-sm text-zinc-400">{description}</p>
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
  onSave: (payload: {
    name: string;
    description: string | null;
  }) => Promise<void>;
  onDelete?: () => Promise<unknown>;
}) {
  return (
    <CategoryDialogContent
      category={category}
      error={error}
      isPending={isPending}
      key={open ? (category?.id ?? "new") : "closed"}
      onDelete={onDelete}
      onOpenChange={onOpenChange}
      onSave={onSave}
      open={open}
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
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="border-zinc-800 bg-[var(--color-carbon)] text-white sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {category ? "Editar categoría" : "Crear categoría"}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({
              name,
              description: description || null,
            }).catch(() => undefined);
          }}
        >
          <Field label="Nombre" required>
            <Input
              className="border-zinc-700 bg-black/20"
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </Field>
          <Field label="Descripción">
            <Textarea
              className="min-h-[80px] border-zinc-700 bg-black/20"
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </Field>
          {error ? (
            <p className="text-red-400 text-sm">
              {getErrorMessage(error, "No se pudo guardar la categoría.")}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            {category && onDelete ? (
              <Button
                className="border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
                disabled={isPending}
                onClick={() => {
                  onDelete()?.catch(() => undefined);
                }}
                type="button"
                variant="outline"
              >
                Eliminar
              </Button>
            ) : (
              <span />
            )}
            <Button
              className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
              disabled={isPending || !name.trim()}
              type="submit"
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
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="border-zinc-800 bg-[var(--color-carbon)] text-white sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Movimiento de stock</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Producto">
            <Popover
              onOpenChange={setProductPickerOpen}
              open={productPickerOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  aria-controls="inventory-product-picker-list"
                  aria-expanded={productPickerOpen}
                  className="w-full justify-between border-zinc-700 bg-black/20 text-white hover:bg-white/5"
                  role="combobox"
                  type="button"
                  variant="outline"
                >
                  <span className="truncate">
                    {product
                      ? `${product.name} (${product.stock})`
                      : "Seleccionar producto..."}
                  </span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 text-zinc-500" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(360px,calc(100vw-2rem))] border-zinc-800 bg-[var(--color-carbon)] p-0 text-white">
                <Command className="bg-transparent">
                  <CommandInput
                    className="text-white placeholder:text-zinc-500"
                    placeholder="Buscar producto..."
                  />
                  <CommandList
                    className="p-1.5"
                    id="inventory-product-picker-list"
                  >
                    <CommandEmpty className="text-zinc-400">
                      No se encontraron productos.
                    </CommandEmpty>
                    {products.map((item) => (
                      <CommandItem
                        className="gap-3 rounded-lg py-2 text-white"
                        key={item.id}
                        onSelect={() => {
                          onProductChange(item);
                          setProductPickerOpen(false);
                        }}
                        value={`${item.name} ${item.id}`}
                      >
                        <span className="truncate">
                          {item.name} ({item.stock})
                        </span>
                        <Check
                          className={cn(
                            "ml-auto size-4 shrink-0",
                            product?.id === item.id
                              ? "opacity-100"
                              : "opacity-0"
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
            <Select onValueChange={onTypeChange} value={type}>
              <SelectTrigger className="w-full border-zinc-700 bg-black/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
                <SelectItem value="restock">Reposición</SelectItem>
                <SelectItem value="waste">Merma</SelectItem>
                <SelectItem value="adjustment">Ajuste</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cantidad" required>
            <Input
              className="border-zinc-700 bg-black/20"
              onChange={(event) => onQuantityChange(event.target.value)}
              required
              type="number"
              value={quantity}
            />
          </Field>
          <Field label="Notas">
            <Textarea
              className="min-h-[80px] border-zinc-700 bg-black/20"
              onChange={(event) => onNotesChange(event.target.value)}
              value={notes}
            />
          </Field>
          {error ? (
            <p className="text-red-400 text-sm">
              {getErrorMessage(error, "No se pudo registrar el movimiento.")}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
            disabled={
              isPending ||
              !product ||
              !Number.isFinite(Number(quantity)) ||
              Number(quantity) === 0
            }
            onClick={() => {
              onSave()?.catch(() => undefined);
            }}
            type="button"
          >
            {isPending ? "Guardando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
