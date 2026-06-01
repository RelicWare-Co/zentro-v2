import path from "node:path";
import {
  app,
  BrowserWindow,
  dialog,
  nativeTheme,
  session,
  shell,
} from "electron";
import started from "electron-squirrel-startup";

const developmentWebUrl = "http://localhost:3000";
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
const desktopContentSecurityPolicy = [
  "default-src 'self' data: blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' http: https: ws: wss:",
].join("; ");

if (started) {
  app.quit();
}

app.setName("Zentro");
nativeTheme.themeSource = "system";

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

const hasSameOrigin = (targetUrl: string, appUrl: string) => {
  try {
    return new URL(targetUrl).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const loadStatusPage = async (
  mainWindow: BrowserWindow,
  title: string,
  description: string
) => {
  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: dark; }
      body {
        align-items: center;
        background: #09090b;
        color: #fafafa;
        display: flex;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        justify-content: center;
        margin: 0;
        min-height: 100vh;
      }
      main {
        background: #18181b;
        border: 1px solid #27272a;
        border-radius: 18px;
        box-shadow: 0 24px 80px rgb(0 0 0 / 0.35);
        max-width: 480px;
        padding: 32px;
      }
      h1 { font-size: 22px; margin: 0 0 12px; }
      p { color: #d4d4d8; line-height: 1.6; margin: 0; }
      code {
        background: #27272a;
        border-radius: 6px;
        color: #f4f4f5;
        padding: 2px 6px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
    </main>
  </body>
</html>`;

  await mainWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
  );
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
  const webAppUrl = getWebAppUrl();

  configureSessionSecurity(webAppUrl);

  const mainWindow = new BrowserWindow({
    backgroundColor: "#09090b",
    height: 900,
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

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (webAppUrl && hasSameOrigin(url, webAppUrl)) {
      mainWindow.loadURL(url).catch(() => undefined);
    } else {
      shell.openExternal(url).catch(() => undefined);
    }

    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!webAppUrl || hasSameOrigin(url, webAppUrl)) {
      return;
    }

    event.preventDefault();
    shell.openExternal(url).catch(() => undefined);
  });

  if (!webAppUrl) {
    await loadStatusPage(
      mainWindow,
      "Configura la URL web de Zentro",
      "Define ZENTRO_DESKTOP_WEB_URL antes de empaquetar la app desktop para indicar qué versión web debe cargar. En desarrollo se usa http://localhost:3000 por defecto."
    );
    return;
  }

  try {
    await mainWindow.loadURL(webAppUrl);
  } catch {
    await loadStatusPage(
      mainWindow,
      "No se pudo cargar Zentro",
      `Revisa que la aplicación web esté disponible en ${webAppUrl}. En desarrollo ejecuta bun run dev antes de abrir Electron.`
    );
  }
};

app
  .whenReady()
  .then(createWindow)
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
  }
});
