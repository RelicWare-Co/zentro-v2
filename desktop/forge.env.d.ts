/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

declare const DESKTOP_SHELL_VITE_DEV_SERVER_URL: string | undefined;
declare const DESKTOP_SHELL_VITE_NAME: string;

interface ImportMetaEnv {
  readonly ZENTRO_DESKTOP_WEB_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
