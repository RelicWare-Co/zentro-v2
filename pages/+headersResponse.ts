import { getSeoMetadata, SEO_SITE_NAME } from "@/lib/seo.shared";

export const headersResponse = (pageContext: unknown) => ({
  "X-Application-Name": SEO_SITE_NAME,
  "X-Robots-Tag": getSeoMetadata(pageContext).robots,
});
