// https://vike.dev/Head

import { usePageContext } from "vike-react/usePageContext";
import { brandColors } from "@/lib/mantine-theme";
import {
  getCanonicalUrl,
  getSeoImageUrl,
  getSeoMetadata,
  SEO_LOCALE,
  SEO_SITE_NAME,
} from "@/lib/seo.shared";

export function Head() {
  const pageContext = usePageContext();
  const seo = getSeoMetadata(pageContext);
  const canonicalUrl = getCanonicalUrl(pageContext, seo.canonicalPath);
  const imageUrl = getSeoImageUrl(pageContext);

  return (
    <>
      <meta
        content="width=device-width, initial-scale=1, viewport-fit=cover"
        name="viewport"
      />
      <link href={canonicalUrl} rel="canonical" />
      <meta content={seo.robots} name="robots" />
      <meta content="strict-origin-when-cross-origin" name="referrer" />
      <meta content="light" name="color-scheme" />
      <meta content={SEO_SITE_NAME} property="og:site_name" />
      <meta content="website" property="og:type" />
      <meta content={canonicalUrl} property="og:url" />
      <meta content={SEO_LOCALE} property="og:locale" />
      <meta content="Zentro POS inteligente" property="og:image:alt" />
      <meta content="1200" property="og:image:width" />
      <meta content="630" property="og:image:height" />
      <meta content={seo.title} name="twitter:title" />
      <meta content={seo.description} name="twitter:description" />
      <meta content={imageUrl} name="twitter:image" />
      <meta content="Zentro POS inteligente" name="twitter:image:alt" />
      <meta content={brandColors.void} name="theme-color" />
      <meta content="Zentro" name="application-name" />
      <meta content="yes" name="mobile-web-app-capable" />
      <meta content="yes" name="apple-mobile-web-app-capable" />
      <meta
        content="black-translucent"
        name="apple-mobile-web-app-status-bar-style"
      />
      <meta content="Zentro" name="apple-mobile-web-app-title" />
      <meta content="telephone=no" name="format-detection" />
      <link href="/manifest.json" rel="manifest" />
      <link href="https://umami.relicware.co" rel="dns-prefetch" />
      <link href="https://umami.relicware.co" rel="preconnect" />
      <script
        data-website-id="80d4a2ff-81ad-4a76-89ba-a7b683cf2ebf"
        defer
        src="https://umami.relicware.co/script.js"
      />
    </>
  );
}
