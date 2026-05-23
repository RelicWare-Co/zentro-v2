import { overview as dashboardOverview } from "./dashboard";
import {
  cancelInvitation,
  deleteOrganization,
  inviteMember,
  joinLinkCreate,
  joinLinkPreview,
  joinLinkRedeem,
  joinLinkRevoke,
  leaveOrganization,
  management,
  removeMember,
  selection,
  updateMemberRole,
  updateOrganization,
} from "./organization";

export const router = {
  organization: {
    joinLinkPreview,
    joinLinkRedeem,
    selection,
    management,
    joinLinkCreate,
    joinLinkRevoke,
    inviteMember,
    cancelInvitation,
    updateMemberRole,
    removeMember,
    leaveOrganization,
    updateOrganization,
    deleteOrganization,
  },
  dashboard: {
    overview: dashboardOverview,
  },
};
