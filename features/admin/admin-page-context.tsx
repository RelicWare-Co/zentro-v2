import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from "react";
import { usePageContext } from "vike-react/usePageContext";
import type { AdminUsersQuery } from "@/features/admin/admin.schema";
import type { AdminPanelUser } from "@/features/admin/admin.shared";
import {
  getAdminUrlParams,
  replaceAdminUrlParams,
} from "@/features/admin/admin-url-state";
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

type UserSortBy = AdminUsersQuery["sortBy"];
type SortDirection = AdminUsersQuery["sortDirection"];

function readBoolean(key: string): boolean | null {
  const value = getAdminUrlParams().get(key);
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

function readNumber(key: string): number | null {
  const value = getAdminUrlParams().get(key);
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function resetUserPage() {
  replaceAdminUrlParams({ u_page: 1 });
}

export interface AdminPageState {
  activeOverlay: AdminPageOverlay | null;
  banned: boolean | null;
  currentUserId: string | null;
  emailVerified: boolean | null;
  endDate: string;
  hasSales: boolean | null;
  isError: boolean;
  isFetching: boolean;
  isPending: boolean;
  organizationId: string;
  page: number;
  pageSize: number;
  paidMax: number | null;
  paidMin: number | null;
  period: "30d" | "custom" | "all";
  role: "admin" | "user" | "";
  searchField: AdminUsersSearchField;
  searchQuery: string;
  sortBy: UserSortBy;
  sortDirection: SortDirection;
  startDate: string;
  summary: { total: number; admins: number; banned: number };
  total: number;
  totalPages: number;
  users: AdminPanelUser[];
}

export interface AdminPageActions {
  clearUserFilters: () => void;
  closeOverlay: () => void;
  openBan: (user: AdminPanelUser) => void;
  openCreate: () => void;
  openDelete: (user: AdminPanelUser) => void;
  openEdit: (user: AdminPanelUser) => void;
  openOrganization: (organizationId: string) => void;
  openPassword: (user: AdminPanelUser) => void;
  openRole: (user: AdminPanelUser) => void;
  openSessions: (user: AdminPanelUser) => void;
  setBanned: (value: boolean | null) => void;
  setEmailVerified: (value: boolean | null) => void;
  setEndDate: (value: string) => void;
  setHasSales: (value: boolean | null) => void;
  setOrganizationId: (value: string) => void;
  setPage: (page: number) => void;
  setPaidMax: (value: number | null) => void;
  setPaidMin: (value: number | null) => void;
  setPeriod: (value: AdminPageState["period"]) => void;
  setRole: (value: AdminPageState["role"]) => void;
  setSearchField: (field: AdminUsersSearchField) => void;
  setSearchQuery: (value: string) => void;
  setSort: (sortBy: UserSortBy) => void;
  setSortDirection: (direction: SortDirection) => void;
  setStartDate: (value: string) => void;
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
  const params = getAdminUrlParams();
  const [searchQuery, setSearchQueryState] = useState(
    () => params.get("u_search") ?? ""
  );
  const [searchField, setSearchFieldState] = useState<AdminUsersSearchField>(
    () => (params.get("u_searchField") === "name" ? "name" : "email")
  );
  const [page, setPageState] = useState(() => {
    const parsed = Number(params.get("u_page"));
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
  });
  const [period, setPeriodState] = useState<AdminPageState["period"]>(() => {
    const value = params.get("u_period");
    return value === "all" || value === "custom" ? value : "30d";
  });
  const [startDate, setStartDateState] = useState(
    () => params.get("u_startDate") ?? ""
  );
  const [endDate, setEndDateState] = useState(
    () => params.get("u_endDate") ?? ""
  );
  const [organizationId, setOrganizationIdState] = useState(
    () => params.get("u_organizationId") ?? ""
  );
  const [role, setRoleState] = useState<AdminPageState["role"]>(() => {
    const value = params.get("u_role");
    return value === "admin" || value === "user" ? value : "";
  });
  const [banned, setBannedState] = useState(() => readBoolean("u_banned"));
  const [emailVerified, setEmailVerifiedState] = useState(() =>
    readBoolean("u_emailVerified")
  );
  const [hasSales, setHasSalesState] = useState(() =>
    readBoolean("u_hasSales")
  );
  const [paidMin, setPaidMinState] = useState(() => readNumber("u_paidMin"));
  const [paidMax, setPaidMaxState] = useState(() => readNumber("u_paidMax"));
  const [sortBy, setSortByState] = useState<UserSortBy>(() => {
    const value = params.get("u_sortBy");
    return value === "name" ||
      value === "lastSaleAt" ||
      value === "paidAmount" ||
      value === "paidAmount30d" ||
      value === "historicalPaidAmount"
      ? value
      : "createdAt";
  });
  const [sortDirection, setSortDirectionState] = useState<SortDirection>(() =>
    params.get("u_sortDirection") === "asc" ? "asc" : "desc"
  );
  const [activeOverlay, setActiveOverlay] = useState<AdminPageOverlay | null>(
    null
  );

  const usersQuery = useAdminUsersQuery({
    period,
    search: searchQuery,
    searchField,
    organizationId: organizationId || undefined,
    role: role || undefined,
    banned,
    emailVerified,
    hasSales,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    paidMin,
    paidMax,
    sortBy,
    sortDirection,
    page,
    pageSize: ADMIN_USERS_PAGE_SIZE,
  });
  const users = usersQuery.data?.users ?? [];
  const total = usersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_USERS_PAGE_SIZE));

  const setUserValue = useCallback(
    <T,>(setter: (value: T) => void, key: string, value: T) => {
      setter(value);
      resetUserPage();
      replaceAdminUrlParams({ [key]: value as string | number | boolean });
      setPageState(1);
    },
    []
  );

  const setSearchQuery = useCallback((value: string) => {
    setSearchQueryState(value);
    setPageState(1);
    replaceAdminUrlParams({ u_search: value, u_page: 1 });
  }, []);
  const setSearchField = useCallback((value: AdminUsersSearchField) => {
    setSearchFieldState(value);
    setPageState(1);
    replaceAdminUrlParams({ u_searchField: value, u_page: 1 });
  }, []);
  const setPage = useCallback((value: number) => {
    const nextPage = Math.max(1, value);
    setPageState(nextPage);
    replaceAdminUrlParams({ u_page: nextPage });
  }, []);

  const setPeriod = useCallback(
    (value: AdminPageState["period"]) =>
      setUserValue(setPeriodState, "u_period", value),
    [setUserValue]
  );
  const setStartDate = useCallback(
    (value: string) => setUserValue(setStartDateState, "u_startDate", value),
    [setUserValue]
  );
  const setEndDate = useCallback(
    (value: string) => setUserValue(setEndDateState, "u_endDate", value),
    [setUserValue]
  );
  const setOrganizationId = useCallback(
    (value: string) =>
      setUserValue(setOrganizationIdState, "u_organizationId", value),
    [setUserValue]
  );
  const setRole = useCallback(
    (value: AdminPageState["role"]) =>
      setUserValue(setRoleState, "u_role", value),
    [setUserValue]
  );
  const setBanned = useCallback(
    (value: boolean | null) => setUserValue(setBannedState, "u_banned", value),
    [setUserValue]
  );
  const setEmailVerified = useCallback(
    (value: boolean | null) =>
      setUserValue(setEmailVerifiedState, "u_emailVerified", value),
    [setUserValue]
  );
  const setHasSales = useCallback(
    (value: boolean | null) =>
      setUserValue(setHasSalesState, "u_hasSales", value),
    [setUserValue]
  );
  const setPaidMin = useCallback(
    (value: number | null) => setUserValue(setPaidMinState, "u_paidMin", value),
    [setUserValue]
  );
  const setPaidMax = useCallback(
    (value: number | null) => setUserValue(setPaidMaxState, "u_paidMax", value),
    [setUserValue]
  );
  const setSort = useCallback((value: UserSortBy) => {
    setSortByState(value);
    setPageState(1);
    replaceAdminUrlParams({ u_sortBy: value, u_page: 1 });
  }, []);
  const setSortDirection = useCallback((value: SortDirection) => {
    setSortDirectionState(value);
    setPageState(1);
    replaceAdminUrlParams({ u_sortDirection: value, u_page: 1 });
  }, []);
  const clearUserFilters = useCallback(() => {
    setSearchQueryState("");
    setSearchFieldState("email");
    setPeriodState("30d");
    setStartDateState("");
    setEndDateState("");
    setOrganizationIdState("");
    setRoleState("");
    setBannedState(null);
    setEmailVerifiedState(null);
    setHasSalesState(null);
    setPaidMinState(null);
    setPaidMaxState(null);
    setSortByState("createdAt");
    setSortDirectionState("desc");
    setPageState(1);
    replaceAdminUrlParams({
      u_search: null,
      u_searchField: null,
      u_period: null,
      u_startDate: null,
      u_endDate: null,
      u_organizationId: null,
      u_role: null,
      u_banned: null,
      u_emailVerified: null,
      u_hasSales: null,
      u_paidMin: null,
      u_paidMax: null,
      u_sortBy: null,
      u_sortDirection: null,
      u_page: null,
    });
  }, []);

  const closeOverlay = useCallback(() => setActiveOverlay(null), []);
  const openCreate = useCallback(
    () => setActiveOverlay({ type: "form", user: null }),
    []
  );
  const openEdit = useCallback(
    (user: AdminPanelUser) => setActiveOverlay({ type: "form", user }),
    []
  );
  const openBan = useCallback(
    (user: AdminPanelUser) => setActiveOverlay({ type: "ban", user }),
    []
  );
  const openRole = useCallback(
    (user: AdminPanelUser) => setActiveOverlay({ type: "role", user }),
    []
  );
  const openPassword = useCallback(
    (user: AdminPanelUser) => setActiveOverlay({ type: "password", user }),
    []
  );
  const openSessions = useCallback(
    (user: AdminPanelUser) => setActiveOverlay({ type: "sessions", user }),
    []
  );
  const openDelete = useCallback(
    (user: AdminPanelUser) => setActiveOverlay({ type: "delete", user }),
    []
  );
  const openOrganization = useCallback(
    (organizationId: string) =>
      setActiveOverlay({ type: "organization", organizationId }),
    []
  );

  const value = useMemo<AdminPageContextValue>(
    () => ({
      state: {
        activeOverlay,
        currentUserId: pageContext.user?.id ?? null,
        isError: usersQuery.isError,
        isFetching: usersQuery.isFetching,
        isPending: usersQuery.isPending,
        page,
        pageSize: ADMIN_USERS_PAGE_SIZE,
        searchField,
        searchQuery,
        period,
        startDate,
        endDate,
        organizationId,
        role,
        banned,
        emailVerified,
        hasSales,
        paidMin,
        paidMax,
        sortBy,
        sortDirection,
        total,
        totalPages,
        users,
        summary: usersQuery.data?.summary ?? { total: 0, admins: 0, banned: 0 },
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
        setSearchField,
        setSearchQuery,
        setPeriod,
        setStartDate,
        setEndDate,
        setOrganizationId,
        setRole,
        setBanned,
        setEmailVerified,
        setHasSales,
        setPaidMin,
        setPaidMax,
        setSort,
        setSortDirection,
        clearUserFilters,
      },
      meta: { usersError: usersQuery.error },
    }),
    [
      activeOverlay,
      banned,
      clearUserFilters,
      closeOverlay,
      emailVerified,
      endDate,
      hasSales,
      openBan,
      openCreate,
      openDelete,
      openEdit,
      openOrganization,
      openPassword,
      openRole,
      openSessions,
      organizationId,
      page,
      pageContext.user?.id,
      paidMax,
      paidMin,
      period,
      role,
      searchField,
      searchQuery,
      setBanned,
      setEmailVerified,
      setEndDate,
      setHasSales,
      setOrganizationId,
      setPaidMax,
      setPaidMin,
      setPeriod,
      setRole,
      setSort,
      setSortDirection,
      setStartDate,
      setPage,
      setSearchField,
      setSearchQuery,
      sortBy,
      sortDirection,
      startDate,
      total,
      totalPages,
      users,
      usersQuery.data?.summary,
      usersQuery.error,
      usersQuery.isError,
      usersQuery.isFetching,
      usersQuery.isPending,
    ]
  );

  return <AdminPageContext value={value}>{children}</AdminPageContext>;
}
