/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

interface ImportMetaEnv {
  readonly ZENTRO_DESKTOP_WEB_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
