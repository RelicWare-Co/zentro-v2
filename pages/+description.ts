import { getSeoMetadata } from "@/lib/seo.shared";

export const description = (pageContext: unknown) =>
  getSeoMetadata(pageContext).description;
