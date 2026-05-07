import { ORPCError, os } from "@orpc/server";
import { auth } from "../../auth";

type AuthInstance = typeof auth;
type AuthSession = AuthInstance["$Infer"]["Session"];

export const authMiddleware = os
	.$context<{
		headers: Headers;
		session?: AuthSession["session"];
		user?: AuthSession["user"];
	}>()
	.middleware(async ({ context, next }) => {
		const fullSession =
			(context.session && context.user
				? { session: context.session, user: context.user }
				: null) ??
			(await auth.api.getSession({ headers: context.headers }));

		if (!fullSession?.session || !fullSession?.user) {
			throw new ORPCError("UNAUTHORIZED", {
				message: "Debes iniciar sesión para continuar.",
			});
		}

		return next({
			context: {
				session: fullSession.session,
				user: fullSession.user,
			},
		});
	});
