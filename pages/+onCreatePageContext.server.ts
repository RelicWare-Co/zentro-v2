import type { PageContextServer } from "vike/types";
import { auth } from "@/server/auth";
import { getPublicZeroCacheURL } from "@/server/runtime-config.server";
import { resolveZeroAuthFromSession } from "@/server/zero/context.server";

export async function onCreatePageContext(pageContext: PageContextServer) {
  const headers = pageContext.headersOriginal as Headers;

  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
  try {
    session = await auth.api.getSession({
      headers,
    });
  } catch {
    // Invalid or expired session — leave session as null
  }

  const zeroAuth = await resolveZeroAuthFromSession(session);

  pageContext.user = session?.user ?? null;
  pageContext.session = session?.session ?? null;
  pageContext.zeroContext = zeroAuth?.ctx ?? null;
  pageContext.zeroCacheURL = getPublicZeroCacheURL();
}
