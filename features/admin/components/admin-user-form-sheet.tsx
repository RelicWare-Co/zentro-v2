import {
  Button,
  Drawer,
  PasswordInput,
  Select,
  TextInput,
} from "@mantine/core";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import {
  ADMIN_ROLE_OPTIONS,
  type AdminPanelUser,
  type AdminRoleValue,
} from "@/features/admin/admin.shared";
import { useAdminPage } from "@/features/admin/admin-page-context";
import { useAdminUserActions } from "@/features/admin/hooks/use-admin-user-actions";
import {
  darkDrawerStyles,
  darkInputStyles,
  darkSelectStyles,
} from "@/lib/mantine-dark";
import { getErrorMessage } from "@/lib/utils";

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
      <div className="shrink-0 border-zinc-800 border-b p-6">
        <p className="text-sm text-zinc-400">
          {editingUser
            ? "Actualiza el nombre o el email del usuario."
            : "Crea una cuenta con email y contraseña."}
        </p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="grid gap-4">
          <TextInput
            label="Nombre"
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Ej. Juan Pérez"
            required
            styles={darkInputStyles}
            value={form.name}
          />
          <TextInput
            label="Email"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
            placeholder="usuario@ejemplo.com"
            required
            styles={darkInputStyles}
            type="email"
            value={form.email}
          />
          {editingUser ? null : (
            <>
              <PasswordInput
                label="Contraseña"
                minLength={8}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Mínimo 8 caracteres"
                required
                styles={darkInputStyles}
                value={form.password}
              />
              <Select
                allowDeselect={false}
                data={ADMIN_ROLE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                label="Rol"
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    role: (value ?? "user") as AdminRoleValue,
                  }))
                }
                styles={darkSelectStyles}
                value={form.role}
              />
            </>
          )}
        </div>

        {formError ? (
          <p className="rounded-md border border-red-400/20 bg-red-400/10 p-3 font-medium text-red-300 text-sm">
            {getErrorMessage(formError, "No se pudo guardar el usuario.")}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-zinc-800 border-t bg-black/30 p-6">
        <Button
          c="black"
          color="voltage.5"
          disabled={!(form.name.trim() && form.email.trim())}
          fullWidth
          loading={isPending}
          type="submit"
        >
          Guardar usuario
        </Button>
      </div>
    </form>
  );
}

export function AdminUserFormSheet() {
  const { state, actions } = useAdminPage();
  const isOpen = state.activeOverlay?.type === "form";
  const editingUser =
    state.activeOverlay?.type === "form" ? state.activeOverlay.user : null;

  return (
    <Drawer
      onClose={actions.closeOverlay}
      opened={isOpen}
      position="right"
      size={540}
      styles={darkDrawerStyles}
      title={editingUser ? "Editar usuario" : "Crear usuario"}
    >
      <AdminUserFormSheetContent
        editingUser={editingUser}
        key={isOpen ? (editingUser?.id ?? "new") : "closed"}
      />
    </Drawer>
  );
}
