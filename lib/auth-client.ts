import { adminClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	plugins: [adminClient(), organizationClient()],
});

export const {
	useSession,
	signIn,
	signUp,
	signOut,
	useActiveOrganization,
	useListOrganizations,
} = authClient;

export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
