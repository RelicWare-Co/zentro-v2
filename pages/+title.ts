import { getSeoMetadata } from "@/lib/seo.shared";

export const title = (pageContext: unknown) =>
  getSeoMetadata(pageContext).title;
