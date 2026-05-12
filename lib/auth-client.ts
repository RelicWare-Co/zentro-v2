import { adminClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	plugins: [adminClient(), organizationClient()],
});

export const {
	
	
	
	
	useActiveOrganization,
	
} = authClient;

type Session = typeof authClient.$Infer.Session;
type User = typeof authClient.$Infer.Session.user;
