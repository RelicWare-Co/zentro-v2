import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
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
import {
  ADMIN_ROLE_OPTIONS,
  type AdminPanelUser,
  type AdminRoleValue,
} from "@/features/admin/admin.shared";
import { useAdminPage } from "@/features/admin/admin-page-context";
import { useAdminUserActions } from "@/features/admin/hooks/use-admin-user-actions";
import { getErrorMessage } from "@/lib/utils";

function AdminUserFormField({
  children,
  htmlFor,
  label,
  required,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}

function AdminUserFormSheetContent({
  editingUser,
}: {
  editingUser: AdminPanelUser | null;
}) {
  const { actions } = useAdminPage();
  const adminActions = useAdminUserActions();
  const [form, setForm] = useState(() => ({
    name: editingUser?.name ?? "",
    email: editingUser?.email ?? "",
    password: "",
    role: (editingUser?.role?.includes("admin")
      ? "admin"
      : "user") as AdminRoleValue,
  }));
  const [formError, setFormError] = useState<unknown>(null);
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const roleId = useId();

  const isPending =
    adminActions.createUser.isPending || adminActions.updateUser.isPending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    try {
      if (editingUser) {
        await adminActions.updateUser.mutateAsync({
          userId: editingUser.id,
          data: {
            name: form.name.trim(),
            email: form.email.trim(),
          },
        });
        toast.success("Usuario actualizado.");
      } else {
        await adminActions.createUser.mutateAsync({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
        });
        toast.success("Usuario creado.");
      }
      actions.closeOverlay();
    } catch (error) {
      setFormError(error);
    }
  };

  return (
    <form className="flex h-full flex-col" onSubmit={handleSubmit}>
      <SheetHeader className="shrink-0 border-zinc-800 border-b p-6">
        <SheetTitle className="font-bold text-2xl">
          {editingUser ? "Editar usuario" : "Crear usuario"}
        </SheetTitle>
        <SheetDescription className="text-zinc-400">
          {editingUser
            ? "Actualiza el nombre o el email del usuario."
            : "Crea una cuenta con email y contraseña."}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="grid gap-4">
          <AdminUserFormField htmlFor={nameId} label="Nombre" required>
            <Input
              className="border-zinc-700 bg-black/20"
              id={nameId}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Ej. Juan Pérez"
              required
              value={form.name}
            />
          </AdminUserFormField>
          <AdminUserFormField htmlFor={emailId} label="Email" required>
            <Input
              className="border-zinc-700 bg-black/20"
              id={emailId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="usuario@ejemplo.com"
              required
              type="email"
              value={form.email}
            />
          </AdminUserFormField>
          {editingUser ? null : (
            <>
              <AdminUserFormField
                htmlFor={passwordId}
                label="Contraseña"
                required
              >
                <Input
                  className="border-zinc-700 bg-black/20"
                  id={passwordId}
                  minLength={8}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Mínimo 8 caracteres"
                  required
                  type="password"
                  value={form.password}
                />
              </AdminUserFormField>
              <AdminUserFormField htmlFor={roleId} label="Rol">
                <Select
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      role: value as AdminRoleValue,
                    }))
                  }
                  value={form.role}
                >
                  <SelectTrigger
                    className="w-full border-zinc-700 bg-black/20 text-white"
                    id={roleId}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
                    {ADMIN_ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AdminUserFormField>
            </>
          )}
        </div>

        {formError ? (
          <p className="rounded-md border border-red-400/20 bg-red-400/10 p-3 font-medium text-red-300 text-sm">
            {getErrorMessage(formError, "No se pudo guardar el usuario.")}
          </p>
        ) : null}
      </div>

      <SheetFooter className="shrink-0 border-zinc-800 border-t bg-black/30 p-6">
        <Button
          className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
          disabled={isPending || !(form.name.trim() && form.email.trim())}
          type="submit"
        >
          {isPending ? "Guardando…" : "Guardar usuario"}
        </Button>
      </SheetFooter>
    </form>
  );
}

export function AdminUserFormSheet() {
  const { state, actions } = useAdminPage();
  const isOpen = state.activeOverlay?.type === "form";
  const editingUser =
    state.activeOverlay?.type === "form" ? state.activeOverlay.user : null;

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          actions.closeOverlay();
        }
      }}
      open={isOpen}
    >
      <SheetContent className="!w-full !max-w-full sm:!w-[540px] overflow-hidden border-zinc-800 border-l bg-[var(--color-carbon)] p-0 text-white">
        <AdminUserFormSheetContent
          editingUser={editingUser}
          key={isOpen ? (editingUser?.id ?? "new") : "closed"}
        />
      </SheetContent>
    </Sheet>
  );
}
