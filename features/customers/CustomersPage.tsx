import { Edit3, Loader2, Plus, Search, Trash2, Users } from "lucide-react";
import { type FormEvent, useState } from "react";
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
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { VirtualTable } from "@/components/ui/virtual-table";
import {
  type Customer,
  useCreateCustomerMutation,
  useCustomersSearch,
  useDeleteCustomerMutation,
  useUpdateCustomerMutation,
} from "@/features/customers/hooks/use-customers";
import { getErrorMessage } from "@/lib/utils";

const DOCUMENT_TYPE_OPTIONS = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "NIT", label: "NIT" },
  { value: "PP", label: "Pasaporte" },
  { value: "TI", label: "Tarjeta de identidad" },
];

const CUSTOMER_TYPE_OPTIONS = [
  { value: "natural", label: "Natural" },
  { value: "juridica", label: "Jurídica" },
];

interface CustomerFormState {
  documentNumber: string;
  documentType: string;
  email: string;
  name: string;
  phone: string;
  type: string;
}

const EMPTY_CUSTOMER_FORM: CustomerFormState = {
  name: "",
  documentType: "",
  documentNumber: "",
  phone: "",
  email: "",
  type: "natural",
};

function getCustomerFormInitialValue(
  customer: Customer | null
): CustomerFormState {
  if (!customer) {
    return EMPTY_CUSTOMER_FORM;
  }
  return {
    name: customer.name,
    documentType: customer.documentType ?? "",
    documentNumber: customer.documentNumber ?? "",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    type: customer.type ?? "natural",
  };
}

export function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(
    null
  );

  const customersQuery = useCustomersSearch(searchQuery);
  const customers = customersQuery.data?.data ?? [];
  const total = customersQuery.data?.total ?? 0;

  const createMutation = useCreateCustomerMutation();
  const updateMutation = useUpdateCustomerMutation();
  const deleteMutation = useDeleteCustomerMutation();

  const formError = createMutation.error ?? updateMutation.error;

  const openCreate = () => {
    setEditingCustomer(null);
    setIsSheetOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsSheetOpen(true);
  };

  if (customersQuery.isPending) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[var(--color-voltage)]" />
      </div>
    );
  }

  if (customersQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl p-6 md:p-8">
        <Alert
          className="border-red-500/20 bg-red-500/10 text-red-100"
          variant="destructive"
        >
          <AlertTitle>No se pudieron cargar los clientes</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            {getErrorMessage(
              customersQuery.error,
              "Intenta recargar la página."
            )}
            <Button
              className="mt-1 w-fit border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
              onClick={() => void customersQuery.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              Reintentar
            </Button>
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
            <h1 className="font-semibold text-3xl tracking-tight">Clientes</h1>
            <Badge className="border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/10">
              {total} clientes
            </Badge>
          </div>
          <p className="text-sm text-zinc-400">
            Gestiona tus clientes y sus datos de contacto.
          </p>
        </div>
        <Button
          className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
          onClick={openCreate}
          type="button"
        >
          <Plus className="size-4" />
          Crear cliente
        </Button>
      </section>

      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
        <Input
          className="border-zinc-800 bg-black/20 pl-9"
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Buscar por nombre, teléfono, documento o email…"
          value={searchQuery}
        />
      </div>

      <VirtualTable
        data={customers}
        emptyState={
          customers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <Users className="size-8 text-zinc-600" />
              <p className="text-sm text-zinc-500">
                {searchQuery.trim()
                  ? "No hay clientes que coincidan con la búsqueda."
                  : "Aún no hay clientes registrados."}
              </p>
              {searchQuery.trim() ? null : (
                <Button
                  className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
                  onClick={openCreate}
                  type="button"
                  variant="outline"
                >
                  <Plus className="mr-2 size-4" />
                  Crear cliente
                </Button>
              )}
            </div>
          ) : null
        }
        estimateSize={72}
        getItemKey={(customer) => customer.id}
        header={
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="px-4 text-zinc-400">Nombre</TableHead>
            <TableHead className="text-zinc-400">Documento</TableHead>
            <TableHead className="text-zinc-400">Teléfono</TableHead>
            <TableHead className="text-zinc-400">Email</TableHead>
            <TableHead className="text-right text-zinc-400">Acciones</TableHead>
          </TableRow>
        }
        maxHeight={600}
        renderRow={(customer) => (
          <>
            <TableCell className="px-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-white">
                  {customer.name}
                </p>
                {customer.type ? (
                  <Badge
                    className="mt-1 border-zinc-700 bg-zinc-800/80 text-zinc-300"
                    variant="outline"
                  >
                    {customer.type === "juridica" ? "Jurídica" : "Natural"}
                  </Badge>
                ) : null}
              </div>
            </TableCell>
            <TableCell className="text-sm text-zinc-300">
              {customer.documentType && customer.documentNumber ? (
                <span>
                  {customer.documentType} {customer.documentNumber}
                </span>
              ) : customer.documentNumber ? (
                <span>{customer.documentNumber}</span>
              ) : (
                <span className="text-zinc-500">-</span>
              )}
            </TableCell>
            <TableCell className="text-sm text-zinc-300">
              {customer.phone ?? <span className="text-zinc-500">-</span>}
            </TableCell>
            <TableCell className="text-sm text-zinc-300">
              {customer.email ?? <span className="text-zinc-500">-</span>}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
                  onClick={() => openEdit(customer)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Edit3 className="size-3.5" />
                </Button>
                <Button
                  className="border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
                  onClick={() => setCustomerToDelete(customer)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </TableCell>
          </>
        )}
      />
      <CustomerFormSheet
        customer={editingCustomer}
        error={formError}
        isPending={createMutation.isPending || updateMutation.isPending}
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) {
            setEditingCustomer(null);
          }
        }}
        onSave={async (payload) => {
          if (payload.id) {
            await updateMutation.mutateAsync({
              id: payload.id,
              ...payload,
            });
            setIsSheetOpen(false);
            setEditingCustomer(null);
          } else {
            await createMutation.mutateAsync(payload);
            setIsSheetOpen(false);
            setEditingCustomer(null);
          }
        }}
        open={isSheetOpen}
      />

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setCustomerToDelete(null);
          }
        }}
        open={Boolean(customerToDelete)}
      >
        <AlertDialogContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {customerToDelete?.name} será removido de la lista activa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={() => {
                if (customerToDelete) {
                  void deleteMutation.mutateAsync({
                    id: customerToDelete.id,
                  });
                }
                setCustomerToDelete(null);
              }}
            >
              {deleteMutation.isPending ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function CustomerFormSheet({
  open,
  onOpenChange,
  customer,
  isPending,
  error,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  isPending: boolean;
  error: unknown;
  onSave: (payload: {
    id?: string;
    name: string;
    documentType: string | null;
    documentNumber: string | null;
    phone: string | null;
    email: string | null;
    type: string | null;
  }) => Promise<void>;
}) {
  return (
    <CustomerFormSheetContent
      customer={customer}
      error={error}
      isPending={isPending}
      key={open ? (customer?.id ?? "new") : "closed"}
      onOpenChange={onOpenChange}
      onSave={onSave}
      open={open}
    />
  );
}

function CustomerFormSheetContent({
  open,
  onOpenChange,
  customer,
  isPending,
  error,
  onSave,
}: Parameters<typeof CustomerFormSheet>[0]) {
  const [form, setForm] = useState(() => getCustomerFormInitialValue(customer));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave({
      ...(customer ? { id: customer.id } : {}),
      name: form.name,
      documentType: form.documentType || null,
      documentNumber: form.documentNumber || null,
      phone: form.phone || null,
      email: form.email || null,
      type: form.type || null,
    });
  };

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="!w-full !max-w-full sm:!w-[540px] overflow-hidden border-zinc-800 border-l bg-[var(--color-carbon)] p-0 text-white">
        <form className="flex h-full flex-col" onSubmit={handleSubmit}>
          <SheetHeader className="shrink-0 border-zinc-800 border-b p-6">
            <SheetTitle className="font-bold text-2xl">
              {customer ? "Editar cliente" : "Crear cliente"}
            </SheetTitle>
            <SheetDescription className="text-zinc-400">
              Datos de contacto e identificación.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            <div className="grid gap-4">
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
              <Field label="Tipo de cliente">
                <Select
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      type: value,
                    }))
                  }
                  value={form.type || "natural"}
                >
                  <SelectTrigger className="w-full border-zinc-700 bg-black/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
                    {CUSTOMER_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tipo de documento">
                <Select
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      documentType: value === "none" ? "" : value,
                    }))
                  }
                  value={form.documentType || "none"}
                >
                  <SelectTrigger className="w-full border-zinc-700 bg-black/20 text-white">
                    <SelectValue placeholder="Sin documento" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
                    <SelectItem value="none">Sin documento</SelectItem>
                    {DOCUMENT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Número de documento">
                <Input
                  className="border-zinc-700 bg-black/20"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      documentNumber: event.target.value,
                    }))
                  }
                  value={form.documentNumber}
                />
              </Field>
              <Field label="Teléfono">
                <Input
                  className="border-zinc-700 bg-black/20"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  type="tel"
                  value={form.phone}
                />
              </Field>
              <Field label="Correo electrónico">
                <Input
                  className="border-zinc-700 bg-black/20"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  type="email"
                  value={form.email}
                />
              </Field>
            </div>

            {error ? (
              <p className="rounded-md border border-red-400/20 bg-red-400/10 p-3 font-medium text-red-300 text-sm">
                {getErrorMessage(error, "No se pudo guardar el cliente.")}
              </p>
            ) : null}
          </div>

          <SheetFooter className="shrink-0 border-zinc-800 border-t bg-black/30 p-6">
            <Button
              className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
              disabled={isPending || !form.name.trim()}
              type="submit"
            >
              {isPending ? "Guardando…" : "Guardar cliente"}
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
