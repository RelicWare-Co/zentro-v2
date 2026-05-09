// https://vike.dev/Head

import logoUrl from "@/assets/logo.svg";

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

export function Head() {
  return (
    <>
      <meta charSet="utf-8" />
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1, viewport-fit=cover"
      />
      <link rel="icon" href={logoUrl} />
      <meta name="theme-color" content="#0f0f0f" />
      <meta name="application-name" content="Zentro" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta
        name="apple-mobile-web-app-status-bar-style"
        content="black-translucent"
      />
      <meta name="apple-mobile-web-app-title" content="Zentro" />
      <meta name="format-detection" content="telephone=no" />
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: required for theme initialization before hydration
        dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
      />
    </>
  );
}
