import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_ROOT_KEY } from "@/features/admin/hooks/use-admin-users";
import { authClient } from "@/lib/auth-client";

interface AuthResult<T> {
  data: T;
  error: null | { message?: string };
}

async function unwrapAuthResult<T>(
  promise: Promise<AuthResult<T>>,
  fallbackMessage: string
): Promise<T> {
  const { data, error } = await promise;
  if (error) {
    throw new Error(error.message ?? fallbackMessage);
  }
  return data;
}

export function useAdminUserActions() {
  const queryClient = useQueryClient();

  const invalidateAdminQueries = () =>
    queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_ROOT_KEY });

  const createUser = useMutation({
    mutationFn: (input: {
      email: string;
      name: string;
      password: string;
      role: "admin" | "user";
    }) =>
      unwrapAuthResult(
        authClient.admin.createUser(input),
        "No se pudo crear el usuario."
      ),
    onSuccess: invalidateAdminQueries,
  });

  const updateUser = useMutation({
    mutationFn: (input: {
      data: { email?: string; name?: string };
      userId: string;
    }) =>
      unwrapAuthResult(
        authClient.admin.updateUser(input),
        "No se pudo actualizar el usuario."
      ),
    onSuccess: invalidateAdminQueries,
  });

  const setRole = useMutation({
    mutationFn: (input: { role: "admin" | "user"; userId: string }) =>
      unwrapAuthResult(
        authClient.admin.setRole(input),
        "No se pudo cambiar el rol."
      ),
    onSuccess: invalidateAdminQueries,
  });

  const setUserPassword = useMutation({
    mutationFn: (input: { newPassword: string; userId: string }) =>
      unwrapAuthResult(
        authClient.admin.setUserPassword(input),
        "No se pudo cambiar la contraseña."
      ),
    onSuccess: invalidateAdminQueries,
  });

  const banUser = useMutation({
    mutationFn: (input: {
      banExpiresIn?: number;
      banReason?: string;
      userId: string;
    }) =>
      unwrapAuthResult(
        authClient.admin.banUser(input),
        "No se pudo suspender al usuario."
      ),
    onSuccess: invalidateAdminQueries,
  });

  const unbanUser = useMutation({
    mutationFn: (input: { userId: string }) =>
      unwrapAuthResult(
        authClient.admin.unbanUser(input),
        "No se pudo reactivar al usuario."
      ),
    onSuccess: invalidateAdminQueries,
  });

  const removeUser = useMutation({
    mutationFn: (input: { userId: string }) =>
      unwrapAuthResult(
        authClient.admin.removeUser(input),
        "No se pudo eliminar el usuario."
      ),
    onSuccess: invalidateAdminQueries,
  });

  const revokeUserSession = useMutation({
    mutationFn: (input: { sessionToken: string }) =>
      unwrapAuthResult(
        authClient.admin.revokeUserSession(input),
        "No se pudo revocar la sesión."
      ),
    onSuccess: invalidateAdminQueries,
  });

  const revokeUserSessions = useMutation({
    mutationFn: (input: { userId: string }) =>
      unwrapAuthResult(
        authClient.admin.revokeUserSessions(input),
        "No se pudieron revocar las sesiones."
      ),
    onSuccess: invalidateAdminQueries,
  });

  const impersonateUser = useMutation({
    mutationFn: (input: { userId: string }) =>
      unwrapAuthResult(
        authClient.admin.impersonateUser(input),
        "No se pudo suplantar al usuario."
      ),
  });

  return {
    banUser,
    createUser,
    impersonateUser,
    removeUser,
    revokeUserSession,
    revokeUserSessions,
    setRole,
    setUserPassword,
    unbanUser,
    updateUser,
  };
}

export type AdminUserActions = ReturnType<typeof useAdminUserActions>;
