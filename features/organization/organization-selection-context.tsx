import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useOrganizationSelection } from "@/features/organization/hooks/use-organization";
import { useOrganizationTransition } from "@/features/organization/organization-transition-context";
import { authClient } from "@/lib/auth-client";

export interface OrganizationListItem {
  id: string;
  name: string;
  slug: string;
}

export interface InvitationItem {
  expiresAt?: number | null;
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: string;
}

export interface OrganizationSelectionState {
  allowOrganizationCreation: boolean;
  contactHref: string | null | undefined;
  contactLabel: string | null | undefined;
  contactMessage: string | null | undefined;
  errorMsg: string | null;
  invitations: InvitationItem[];
  isAcceptingInvitationId: string | null;
  isCreating: boolean;
  isInitialLoading: boolean;
  isRejectingInvitationId: string | null;
  isSelectingId: string | null;
  isSubmitting: boolean;
  newOrgName: string;
  newOrgSlug: string;
  organizations: OrganizationListItem[];
  slugModified: boolean;
}

export interface OrganizationSelectionActions {
  acceptInvitation: (invitation: InvitationItem) => Promise<void>;
  closeCreateForm: () => void;
  openCreateForm: () => void;
  rejectInvitation: (invitationId: string) => Promise<void>;
  selectOrganization: (orgId: string) => Promise<void>;
  setErrorMsg: (message: string | null) => void;
  setNewOrgName: (value: string) => void;
  setNewOrgSlug: (value: string) => void;
  signOut: () => Promise<void>;
  submitCreateOrganization: (event: React.FormEvent) => Promise<void>;
}

export interface OrganizationSelectionMeta {
  orgNameInputId: string;
  orgSlugInputId: string;
}

export interface OrganizationSelectionContextValue {
  actions: OrganizationSelectionActions;
  meta: OrganizationSelectionMeta;
  state: OrganizationSelectionState;
}

const OrganizationSelectionContext =
  createContext<OrganizationSelectionContextValue | null>(null);

export function useOrganizationSelectionPage() {
  const context = use(OrganizationSelectionContext);
  if (!context) {
    throw new Error(
      "useOrganizationSelectionPage must be used within OrganizationSelectionProvider."
    );
  }
  return context;
}

export function OrganizationSelectionProvider({
  children,
  orgNameInputId,
  orgSlugInputId,
}: {
  children: ReactNode;
  orgNameInputId: string;
  orgSlugInputId: string;
}) {
  const organizationsQuery = authClient.useListOrganizations();
  const {
    data: organizations,
    isPending: isOrganizationsPending,
    refetch: refetchOrganizations,
  } = organizationsQuery;
  const selectionQuery = useOrganizationSelection();
  const {
    data: selectionData,
    isPending: isSelectionPending,
    refetch: refetchSelectionData,
  } = selectionQuery;
  const { runOrganizationTransition } = useOrganizationTransition();

  const [isCreating, setIsCreating] = useState(false);
  const [newOrgName, setNewOrgNameState] = useState("");
  const [newOrgSlug, setNewOrgSlugState] = useState("");
  const [slugModified, setSlugModified] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSelectingId, setIsSelectingId] = useState<string | null>(null);
  const [isAcceptingInvitationId, setIsAcceptingInvitationId] = useState<
    string | null
  >(null);
  const [isRejectingInvitationId, setIsRejectingInvitationId] = useState<
    string | null
  >(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refetchOrganizations().catch(() => undefined);
        refetchSelectionData().catch(() => undefined);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refetchSelectionData, refetchOrganizations]);

  const enterOrganizationWorkspace = useCallback(
    (message = "Entrando a la organización...") =>
      runOrganizationTransition({
        destination: "/dashboard",
        message,
        prepare: async () => undefined,
      }),
    [runOrganizationTransition]
  );

  const selectOrganization = useCallback(
    async (orgId: string) => {
      setErrorMsg(null);
      setIsSelectingId(orgId);
      try {
        await runOrganizationTransition({
          message: "Entrando a la organización...",
          prepare: async () => {
            const result = await authClient.organization.setActive({
              organizationId: orgId,
            });
            if (result?.error) {
              throw new Error(
                result.error.message ||
                  "No se pudo seleccionar la organización."
              );
            }
          },
        });
      } catch (error) {
        if (error instanceof Error) {
          setErrorMsg(error.message);
        }
      } finally {
        setIsSelectingId(null);
      }
    },
    [runOrganizationTransition]
  );

  const setNewOrgName = useCallback(
    (nextName: string) => {
      setNewOrgNameState(nextName);
      if (!slugModified) {
        setNewOrgSlugState(
          nextName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "")
        );
      }
    },
    [slugModified]
  );

  const setNewOrgSlug = useCallback((value: string) => {
    setNewOrgSlugState(value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    setSlugModified(true);
  }, []);

  const submitCreateOrganization = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setErrorMsg(null);
      setIsSubmitting(true);

      try {
        if (!(newOrgName && newOrgSlug)) {
          setErrorMsg(
            "Completa el nombre y el identificador antes de continuar."
          );
          return;
        }

        const checkResult = await authClient.organization.checkSlug({
          slug: newOrgSlug,
        });

        if (checkResult?.error) {
          setErrorMsg(
            checkResult.error.message ||
              "No fue posible validar el identificador de la organización."
          );
          return;
        }

        if (checkResult?.data?.status === false) {
          setErrorMsg("Ese identificador ya está en uso. Elige otro.");
          return;
        }

        const result = await authClient.organization.create({
          name: newOrgName,
          slug: newOrgSlug,
        });

        if (result?.error) {
          setErrorMsg(
            result.error.message || "No se pudo crear la organización."
          );
          return;
        }

        if (result?.data) {
          const activateResult = await authClient.organization.setActive({
            organizationId: result.data.id,
          });
          if (activateResult?.error) {
            setErrorMsg(
              activateResult.error.message ||
                "La organización se creó, pero no se pudo activar."
            );
            await refetchOrganizations();
            return;
          }

          await refetchOrganizations();
          await enterOrganizationWorkspace("Organización creada. Entrando...");
        }
      } catch {
        setErrorMsg("Ocurrió un error inesperado al crear la organización.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [newOrgName, newOrgSlug, refetchOrganizations, enterOrganizationWorkspace]
  );

  const acceptInvitation = useCallback(
    async (invitation: InvitationItem) => {
      setErrorMsg(null);
      setIsAcceptingInvitationId(invitation.id);

      try {
        const result = await authClient.organization.acceptInvitation({
          invitationId: invitation.id,
        });

        if (result?.error) {
          setErrorMsg(
            result.error.message || "No se pudo aceptar la invitación."
          );
          return;
        }

        const activateResult = await authClient.organization.setActive({
          organizationId: invitation.organizationId,
        });
        if (activateResult?.error) {
          setErrorMsg(
            activateResult.error.message ||
              "No se pudo activar la organización de la invitación."
          );
          return;
        }

        await Promise.all([refetchOrganizations(), refetchSelectionData()]);
        await enterOrganizationWorkspace("Invitación aceptada. Entrando...");
      } catch (error) {
        setErrorMsg(
          error instanceof Error
            ? error.message
            : "No se pudo aceptar la invitación."
        );
      } finally {
        setIsAcceptingInvitationId(null);
      }
    },
    [enterOrganizationWorkspace, refetchOrganizations, refetchSelectionData]
  );

  const rejectInvitation = useCallback(
    async (invitationId: string) => {
      setErrorMsg(null);
      setIsRejectingInvitationId(invitationId);

      try {
        const result = await authClient.organization.rejectInvitation({
          invitationId,
        });

        if (result?.error) {
          setErrorMsg(
            result.error.message || "No se pudo rechazar la invitación."
          );
          return;
        }

        await refetchSelectionData();
      } catch {
        setErrorMsg("No se pudo rechazar la invitación.");
      } finally {
        setIsRejectingInvitationId(null);
      }
    },
    [refetchSelectionData]
  );

  const openCreateForm = useCallback(() => {
    setErrorMsg(null);
    setIsCreating(true);
  }, []);

  const closeCreateForm = useCallback(() => {
    setIsCreating(false);
    setNewOrgNameState("");
    setNewOrgSlugState("");
    setSlugModified(false);
    setErrorMsg(null);
  }, []);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    window.location.href = "/login";
  }, []);

  const isInitialLoading =
    (isOrganizationsPending && organizations === undefined) ||
    (isSelectionPending && selectionData === undefined);

  const value = useMemo<OrganizationSelectionContextValue>(
    () => ({
      state: {
        organizations: (organizations ?? []) as OrganizationListItem[],
        invitations: selectionData?.invitations ?? [],
        allowOrganizationCreation:
          selectionData?.allowOrganizationCreation ?? true,
        contactMessage: selectionData?.contactMessage,
        contactHref: selectionData?.contactHref,
        contactLabel: selectionData?.contactLabel,
        isInitialLoading,
        isCreating,
        newOrgName,
        newOrgSlug,
        slugModified,
        errorMsg,
        isSubmitting,
        isSelectingId,
        isAcceptingInvitationId,
        isRejectingInvitationId,
      },
      actions: {
        selectOrganization,
        submitCreateOrganization,
        acceptInvitation,
        rejectInvitation,
        signOut,
        openCreateForm,
        closeCreateForm,
        setNewOrgName,
        setNewOrgSlug,
        setErrorMsg,
      },
      meta: {
        orgNameInputId,
        orgSlugInputId,
      },
    }),
    [
      organizations,
      selectionData,
      isInitialLoading,
      isCreating,
      newOrgName,
      newOrgSlug,
      slugModified,
      errorMsg,
      isSubmitting,
      isSelectingId,
      isAcceptingInvitationId,
      isRejectingInvitationId,
      selectOrganization,
      submitCreateOrganization,
      acceptInvitation,
      rejectInvitation,
      signOut,
      openCreateForm,
      closeCreateForm,
      setNewOrgName,
      setNewOrgSlug,
      orgNameInputId,
      orgSlugInputId,
    ]
  );

  return (
    <OrganizationSelectionContext value={value}>
      {children}
    </OrganizationSelectionContext>
  );
}
