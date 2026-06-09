import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  session,
  shell,
} from "electron";

import { type DesktopConnectionStatus, desktopIpc } from "./desktop-api";

declare const DESKTOP_SHELL_VITE_DEV_SERVER_URL: string | undefined;
declare const DESKTOP_SHELL_VITE_NAME: string;

const developmentWebUrl = "http://localhost:3000";
const connectionTimeoutMs = 8000;
const maxConnectionAttempts = 5;
const connectionRetryBaseDelayMs = 1000;
const desktopShellDevPath = "/src/renderer/index.html";
const allowedPermissions = new Set([
  "bluetooth",
  "clipboard-read",
  "display-capture",
  "fullscreen",
  "hid",
  "media",
  "notifications",
  "serial",
  "usb",
]);
// Must stay aligned with analytics script origins in pages/+Head.tsx.
const umamiAnalyticsOrigin = "https://umami.relicware.co";
const desktopContentSecurityPolicy = [
  "default-src 'self' data: blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline' ${umamiAnalyticsOrigin}`,
  "connect-src 'self' http: https: ws: wss:",
].join("; ");

const handleSquirrelStartupEvent = () => {
  if (process.platform !== "win32") {
    return false;
  }

  const squirrelCommand = process.argv[1];
  const target = path.basename(process.execPath);
  const updateExe = path.resolve(
    path.dirname(process.execPath),
    "..",
    "Update.exe"
  );

  if (
    squirrelCommand === "--squirrel-install" ||
    squirrelCommand === "--squirrel-updated"
  ) {
    spawn(updateExe, [`--createShortcut=${target}`], { detached: true }).on(
      "close",
      () => app.quit()
    );
    return true;
  }

  if (squirrelCommand === "--squirrel-uninstall") {
    spawn(updateExe, [`--removeShortcut=${target}`], { detached: true }).on(
      "close",
      () => app.quit()
    );
    return true;
  }

  if (squirrelCommand === "--squirrel-obsolete") {
    app.quit();
    return true;
  }

  return false;
};

if (handleSquirrelStartupEvent()) {
  app.quit();
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
}

app.setName("Zentro");
nativeTheme.themeSource = "system";

let mainWindow: BrowserWindow | null = null;
let configuredWebAppUrl: string | null = null;
let connectionAttempt: Promise<void> | null = null;
let currentStatus: DesktopConnectionStatus = {
  message: "Estamos verificando la conexión con la aplicación web de Zentro.",
  state: "checking",
  webAppUrl: null,
};

const parseWebUrl = (rawUrl: string | undefined) => {
  if (!rawUrl?.trim()) {
    return null;
  }

  try {
    const url = new URL(rawUrl.trim());

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
};

const getWebAppUrl = () =>
  parseWebUrl(process.env.ZENTRO_DESKTOP_WEB_URL) ??
  parseWebUrl(import.meta.env.ZENTRO_DESKTOP_WEB_URL) ??
  (app.isPackaged ? null : developmentWebUrl);

// Electron Forge emits the main bundle as CommonJS. Rolldown currently
// rewrites `import.meta.dirname` to an undefined placeholder there, so the
// Electron main process must use the CommonJS dirname for renderer files.
// biome-ignore lint/correctness/noGlobalDirnameFilename: Electron Forge main output is CommonJS.
const electronMainDir = __dirname;

const resolveIconPath = () => {
  const candidates = [
    path.join(electronMainDir, "assets", "icon.png"),
    path.join(electronMainDir, "..", "assets", "icon.png"),
    path.join(electronMainDir, "..", "..", "assets", "icon.png"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

const setAppIcon = () => {
  const iconPath = resolveIconPath();

  if (!iconPath) {
    return;
  }

  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(iconPath);
  }
};

const getDesktopShellHtmlPath = () =>
  // Forge/Vite preserves the renderer input path under `.vite/renderer`.
  path.join(
    electronMainDir,
    `../renderer/${DESKTOP_SHELL_VITE_NAME}${desktopShellDevPath}`
  );

const getDesktopShellDevUrl = () => {
  if (!DESKTOP_SHELL_VITE_DEV_SERVER_URL) {
    return null;
  }

  return new URL(
    desktopShellDevPath,
    DESKTOP_SHELL_VITE_DEV_SERVER_URL
  ).toString();
};

const getDesktopShellUrl = () =>
  getDesktopShellDevUrl() ??
  pathToFileURL(getDesktopShellHtmlPath()).toString();

const hasSameOrigin = (targetUrl: string, appUrl: string) => {
  try {
    const target = new URL(targetUrl);
    const appOrigin = new URL(appUrl);

    if (target.protocol === "file:" || appOrigin.protocol === "file:") {
      return target.href === appOrigin.href;
    }

    return target.origin === appOrigin.origin;
  } catch {
    return false;
  }
};

const isDesktopShellUrl = (targetUrl: string) => {
  const desktopShellUrl = getDesktopShellUrl();

  return (
    targetUrl === desktopShellUrl ||
    targetUrl.startsWith(`${desktopShellUrl}#`) ||
    (desktopShellUrl.startsWith("http") &&
      hasSameOrigin(targetUrl, desktopShellUrl))
  );
};

const isAllowedAppNavigation = (targetUrl: string, appUrl: string | null) =>
  isDesktopShellUrl(targetUrl) ||
  Boolean(appUrl && hasSameOrigin(targetUrl, appUrl));

const canOpenExternalUrl = (targetUrl: string) => {
  try {
    const { protocol } = new URL(targetUrl);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

const sendConnectionStatus = (
  browserWindow: BrowserWindow,
  status: DesktopConnectionStatus
) => {
  currentStatus = status;

  if (!browserWindow.isDestroyed()) {
    browserWindow.webContents.send(desktopIpc.connectionStatus, status);
  }
};

const loadDesktopShell = async (browserWindow: BrowserWindow) => {
  if (DESKTOP_SHELL_VITE_DEV_SERVER_URL) {
    await browserWindow.loadURL(getDesktopShellUrl());
  } else {
    await browserWindow.loadFile(getDesktopShellHtmlPath());
  }

  sendConnectionStatus(browserWindow, currentStatus);
};

const checkWebAppConnection = async (webAppUrl: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), connectionTimeoutMs);

  try {
    const response = await fetch(webAppUrl, {
      cache: "no-store",
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });

    return response.status < 500 && hasSameOrigin(response.url, webAppUrl);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

const showOfflineStatus = async (
  browserWindow: BrowserWindow,
  webAppUrl: string,
  message = `No pudimos conectar con ${webAppUrl}. Verifica tu conexión o que la aplicación web esté disponible.`
) => {
  sendConnectionStatus(browserWindow, {
    message,
    state: "offline",
    webAppUrl,
  });

  if (!isDesktopShellUrl(browserWindow.webContents.getURL())) {
    await loadDesktopShell(browserWindow);
  }
};

const connectToWebApp = async () => {
  const browserWindow = mainWindow;
  const webAppUrl = configuredWebAppUrl;

  if (!browserWindow || browserWindow.isDestroyed()) {
    return;
  }

  if (!webAppUrl) {
    sendConnectionStatus(browserWindow, {
      message:
        "Define ZENTRO_DESKTOP_WEB_URL antes de empaquetar la app desktop para indicar qué versión web debe cargar.",
      state: "configuration-error",
      webAppUrl: null,
    });
    return;
  }

  for (let attempt = 1; attempt <= maxConnectionAttempts; attempt++) {
    if (browserWindow.isDestroyed()) {
      return;
    }

    sendConnectionStatus(browserWindow, {
      message:
        attempt === 1
          ? `Estamos verificando que ${webAppUrl} responda antes de abrir Zentro.`
          : `Reintentando conexión con ${webAppUrl} (intento ${attempt} de ${maxConnectionAttempts}).`,
      state: "checking",
      webAppUrl,
    });

    const hasConnection = await checkWebAppConnection(webAppUrl);

    if (hasConnection) {
      try {
        await browserWindow.loadURL(webAppUrl);
        return;
      } catch {
        if (attempt < maxConnectionAttempts) {
          await new Promise((resolve) =>
            setTimeout(resolve, connectionRetryBaseDelayMs * 2 ** (attempt - 1))
          );
          continue;
        }
        await showOfflineStatus(
          browserWindow,
          webAppUrl,
          `La conexión respondió, pero Electron no pudo cargar ${webAppUrl}. Intenta de nuevo en unos segundos.`
        );
        return;
      }
    }

    if (attempt < maxConnectionAttempts) {
      await new Promise((resolve) =>
        setTimeout(resolve, connectionRetryBaseDelayMs * 2 ** (attempt - 1))
      );
    }
  }

  await showOfflineStatus(browserWindow, webAppUrl);
};

const retryConnection = () => {
  if (connectionAttempt) {
    return connectionAttempt;
  }

  connectionAttempt = connectToWebApp().finally(() => {
    connectionAttempt = null;
  });

  return connectionAttempt;
};

const hasResponseHeader = (
  responseHeaders: Record<string, string[]> | undefined,
  headerName: string
) =>
  Boolean(
    responseHeaders &&
      Object.keys(responseHeaders).some(
        (key) => key.toLowerCase() === headerName.toLowerCase()
      )
  );

const configureSessionSecurity = (webAppUrl: string | null) => {
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const requestingUrl = details.requestingUrl || webContents.getURL();

      callback(
        Boolean(
          webAppUrl &&
            hasSameOrigin(requestingUrl, webAppUrl) &&
            allowedPermissions.has(permission)
        )
      );
    }
  );

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders ?? {};

    if (
      !(webAppUrl && hasSameOrigin(details.url, webAppUrl)) ||
      hasResponseHeader(responseHeaders, "content-security-policy")
    ) {
      callback({ responseHeaders });
      return;
    }

    callback({
      responseHeaders: {
        ...responseHeaders,
        "Content-Security-Policy": [desktopContentSecurityPolicy],
      },
    });
  });
};

const createWindow = async () => {
  setAppIcon();
  configuredWebAppUrl = getWebAppUrl();
  currentStatus = {
    message: configuredWebAppUrl
      ? `Estamos verificando que ${configuredWebAppUrl} responda antes de abrir Zentro.`
      : "Estamos verificando la configuración de la app desktop de Zentro.",
    state: "checking",
    webAppUrl: configuredWebAppUrl,
  };

  configureSessionSecurity(configuredWebAppUrl);

  mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    backgroundColor: "#09090b",
    height: 900,
    icon: path.join(electronMainDir, "assets", "icon.png"),
    minHeight: 720,
    minWidth: 1024,
    show: false,
    title: "Zentro",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Electron Forge emits the main bundle as CommonJS. Rolldown currently
      // rewrites `import.meta.dirname` to an undefined placeholder there, so
      // the Electron main process must use the CommonJS dirname for preload.
      // biome-ignore lint/correctness/noGlobalDirnameFilename: Electron Forge main output is CommonJS.
      preload: path.join(__dirname, "preload.js"),
      sandbox: true,
      webSecurity: true,
    },
    width: 1440,
  });

  const browserWindow = mainWindow;

  browserWindow.once("ready-to-show", () => {
    browserWindow.show();
  });

  browserWindow.on("closed", () => {
    if (mainWindow === browserWindow) {
      mainWindow = null;
      connectionAttempt = null;
    }
  });

  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (configuredWebAppUrl && hasSameOrigin(url, configuredWebAppUrl)) {
      browserWindow.loadURL(url).catch(() => undefined);
    } else if (!isDesktopShellUrl(url) && canOpenExternalUrl(url)) {
      shell.openExternal(url).catch(() => undefined);
    }

    return { action: "deny" };
  });

  browserWindow.webContents.on("will-navigate", (event, url) => {
    if (isAllowedAppNavigation(url, configuredWebAppUrl)) {
      return;
    }

    event.preventDefault();

    if (canOpenExternalUrl(url)) {
      shell.openExternal(url).catch(() => undefined);
    }
  });

  browserWindow.webContents.on("will-redirect", (event, url) => {
    if (isAllowedAppNavigation(url, configuredWebAppUrl)) {
      return;
    }

    event.preventDefault();

    if (configuredWebAppUrl) {
      showOfflineStatus(
        browserWindow,
        configuredWebAppUrl,
        `Zentro intentó redirigir a ${url}, que no pertenece al origen configurado. Revisa la URL de la aplicación e intenta de nuevo.`
      ).catch(() => undefined);
    }
  });

  browserWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      if (
        !(
          configuredWebAppUrl &&
          hasSameOrigin(validatedURL, configuredWebAppUrl)
        )
      ) {
        return;
      }

      if (browserWindow.isDestroyed()) {
        return;
      }

      const webAppUrl = configuredWebAppUrl;

      console.warn(
        `[desktop] Failed to load ${validatedURL}: ${errorCode} ${errorDescription}. Retrying...`
      );

      setTimeout(() => {
        if (!browserWindow.isDestroyed()) {
          browserWindow.loadURL(webAppUrl).catch(() => undefined);
        }
      }, 2000);
    }
  );

  await loadDesktopShell(browserWindow);
  await retryConnection();
};

const focusMainWindow = () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  mainWindow.focus();
};

if (gotTheLock) {
  app.on("second-instance", () => {
    if (mainWindow) {
      focusMainWindow();
      return;
    }

    createWindow().catch(() => undefined);
  });

  ipcMain.handle(desktopIpc.getConnectionStatus, () => currentStatus);
  ipcMain.handle(desktopIpc.retryConnection, retryConnection);
  ipcMain.handle(desktopIpc.openDevTools, () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    mainWindow.webContents.openDevTools({ mode: "detach" });
  });

  app
    .whenReady()
    .then(() => {
      Menu.setApplicationMenu(null);
      return createWindow();
    })
    .catch((error: unknown) => {
      dialog.showErrorBox(
        "No se pudo abrir Zentro",
        error instanceof Error
          ? error.message
          : "Error desconocido al crear la ventana."
      );
      app.quit();
    });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(() => undefined);
    } else {
      focusMainWindow();
    }
  });
}
