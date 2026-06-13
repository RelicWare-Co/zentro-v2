import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from "react";
import { usePageContext } from "vike-react/usePageContext";
import type { AdminPanelUser } from "@/features/admin/admin.shared";
import {
  ADMIN_USERS_PAGE_SIZE,
  type AdminUsersSearchField,
  useAdminUsersQuery,
} from "@/features/admin/hooks/use-admin-users";

export type AdminPageOverlay =
  | { type: "ban"; user: AdminPanelUser }
  | { type: "delete"; user: AdminPanelUser }
  | { type: "form"; user: AdminPanelUser | null }
  | { type: "organization"; organizationId: string }
  | { type: "password"; user: AdminPanelUser }
  | { type: "role"; user: AdminPanelUser }
  | { type: "sessions"; user: AdminPanelUser };

export interface AdminPageState {
  activeOverlay: AdminPageOverlay | null;
  currentUserId: string | null;
  isError: boolean;
  isFetching: boolean;
  isPending: boolean;
  page: number;
  searchField: AdminUsersSearchField;
  searchQuery: string;
  total: number;
  totalPages: number;
  users: AdminPanelUser[];
}

export interface AdminPageActions {
  closeOverlay: () => void;
  openBan: (user: AdminPanelUser) => void;
  openCreate: () => void;
  openDelete: (user: AdminPanelUser) => void;
  openEdit: (user: AdminPanelUser) => void;
  openOrganization: (organizationId: string) => void;
  openPassword: (user: AdminPanelUser) => void;
  openRole: (user: AdminPanelUser) => void;
  openSessions: (user: AdminPanelUser) => void;
  setPage: (page: number) => void;
  setSearchField: (field: AdminUsersSearchField) => void;
  setSearchQuery: (value: string) => void;
}

export interface AdminPageContextValue {
  actions: AdminPageActions;
  meta: { usersError: unknown };
  state: AdminPageState;
}

const AdminPageContext = createContext<AdminPageContextValue | null>(null);

export function useAdminPage() {
  const context = use(AdminPageContext);
  if (!context) {
    throw new Error("useAdminPage must be used within AdminPageProvider.");
  }
  return context;
}

export function AdminPageProvider({ children }: { children: ReactNode }) {
  const pageContext = usePageContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchFieldState] =
    useState<AdminUsersSearchField>("email");
  const [page, setPage] = useState(1);
  const [activeOverlay, setActiveOverlay] = useState<AdminPageOverlay | null>(
    null
  );

  const usersQuery = useAdminUsersQuery({ page, searchField, searchQuery });
  const users = usersQuery.data?.users ?? [];
  const total = usersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_USERS_PAGE_SIZE));

  const handleSetSearchQuery = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(1);
  }, []);

  const handleSetSearchField = useCallback((field: AdminUsersSearchField) => {
    setSearchFieldState(field);
    setPage(1);
  }, []);

  const closeOverlay = useCallback(() => {
    setActiveOverlay(null);
  }, []);

  const openCreate = useCallback(() => {
    setActiveOverlay({ type: "form", user: null });
  }, []);

  const openEdit = useCallback((user: AdminPanelUser) => {
    setActiveOverlay({ type: "form", user });
  }, []);

  const openBan = useCallback((user: AdminPanelUser) => {
    setActiveOverlay({ type: "ban", user });
  }, []);

  const openRole = useCallback((user: AdminPanelUser) => {
    setActiveOverlay({ type: "role", user });
  }, []);

  const openPassword = useCallback((user: AdminPanelUser) => {
    setActiveOverlay({ type: "password", user });
  }, []);

  const openSessions = useCallback((user: AdminPanelUser) => {
    setActiveOverlay({ type: "sessions", user });
  }, []);

  const openDelete = useCallback((user: AdminPanelUser) => {
    setActiveOverlay({ type: "delete", user });
  }, []);

  const openOrganization = useCallback((organizationId: string) => {
    setActiveOverlay({ type: "organization", organizationId });
  }, []);

  const value = useMemo<AdminPageContextValue>(
    () => ({
      state: {
        activeOverlay,
        currentUserId: pageContext.user?.id ?? null,
        isError: usersQuery.isError,
        isFetching: usersQuery.isFetching,
        isPending: usersQuery.isPending,
        page,
        searchField,
        searchQuery,
        total,
        totalPages,
        users,
      },
      actions: {
        closeOverlay,
        openBan,
        openCreate,
        openDelete,
        openEdit,
        openOrganization,
        openPassword,
        openRole,
        openSessions,
        setPage,
        setSearchField: handleSetSearchField,
        setSearchQuery: handleSetSearchQuery,
      },
      meta: {
        usersError: usersQuery.error,
      },
    }),
    [
      activeOverlay,
      closeOverlay,
      handleSetSearchField,
      handleSetSearchQuery,
      openBan,
      openCreate,
      openDelete,
      openEdit,
      openOrganization,
      openPassword,
      openRole,
      openSessions,
      page,
      pageContext.user?.id,
      searchField,
      searchQuery,
      total,
      totalPages,
      users,
      usersQuery.error,
      usersQuery.isError,
      usersQuery.isFetching,
      usersQuery.isPending,
    ]
  );

  return <AdminPageContext value={value}>{children}</AdminPageContext>;
}
