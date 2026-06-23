// https://vike.dev/Head

import logoUrl from "@/assets/logo.svg";
import { brandColors } from "@/lib/mantine-theme";

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

export function Head() {
  return (
    <>
      <meta charSet="utf-8" />
      <meta
        content="width=device-width, initial-scale=1, viewport-fit=cover"
        name="viewport"
      />
      <link href={logoUrl} rel="icon" />
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
      <script>{THEME_INIT_SCRIPT}</script>
      <script
        data-website-id="80d4a2ff-81ad-4a76-89ba-a7b683cf2ebf"
        defer
        src="https://umami.relicware.co/script.js"
      />
      <script
        data-mask-level="moderate"
        data-max-duration="300000"
        data-sample-rate="0.5"
        data-website-id="80d4a2ff-81ad-4a76-89ba-a7b683cf2ebf"
        defer
        src="https://umami.relicware.co/recorder.js"
      />
    </>
  );
}
