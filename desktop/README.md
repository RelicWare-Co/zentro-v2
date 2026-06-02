# Zentro Desktop

Wrapper Electron de la aplicación web de Zentro. Esta app no embebe el servidor ni la base de datos: carga la versión web configurada en una ventana desktop endurecida.

## Desarrollo

1. Levanta la app web y Zero desde la raíz del repo:

   ```sh
   bun run dev
   ```

2. En otra terminal, abre Electron:

   ```sh
   bun run desktop:dev
   ```

Si `ZENTRO_DESKTOP_WEB_URL` no está definido, desarrollo carga `http://localhost:3000`.

## Splash y conexión

Electron carga primero un renderer local en `desktop/src/renderer/` con los estilos/componentes compartidos de la app. Ese splash verifica que la URL web responda antes de navegar a Zentro. Si la app web no está disponible, se mantiene una pantalla desktop local con botón para reintentar en lugar de dejar la ventana en blanco.

## Iconos

Los iconos de la app (dock, `.icns`, `.ico`, PNG) se generan desde `desktop/assets/logo-icon.svg`, un tile cuadrado sin esquinas blancas. Si cambias la marca, edita ese SVG y ejecuta:

```sh
bun run --cwd desktop icons
```

Requiere ImageMagick (`magick`). En macOS también genera `icon.icns` con `iconutil`.

## Empaquetar

Copia la configuración de ejemplo y define la URL pública de la app web antes de empaquetar:

```sh
cp desktop/.env.example desktop/.env
# edita ZENTRO_DESKTOP_WEB_URL
bun run desktop:make
```

`ZENTRO_DESKTOP_WEB_URL` se inyecta en el build de Electron. También puedes pasarlo inline:

```sh
ZENTRO_DESKTOP_WEB_URL="https://app.tu-dominio.com" bun run desktop:make
```

## Windows (MSIX y Microsoft Store)

El empaquetado MSIX **solo puede ejecutarse en Windows 10/11** con el [Windows SDK](https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/) instalado. En macOS/Linux puedes seguir usando `desktop:make` para `.zip` / `.deb`; para Store usa una máquina Windows o el workflow de GitHub Actions.

### Requisitos en la PC de build

1. Windows 10 u 11 (64-bit).
2. Windows SDK (incluye `makeappx.exe`, `makepri.exe`, `signtool.exe`).
3. Bun y dependencias del monorepo (`bun install` en la raíz).
4. ImageMagick (`magick`) para regenerar iconos/tiles MSIX: `bun run --cwd desktop icons`.

### Configuración

1. URL de producción en `desktop/.env` (`ZENTRO_DESKTOP_WEB_URL`).
2. Copia `desktop/msix/.env.example` → `desktop/msix/.env` y rellena identidad de Partner Center cuando vayas a publicar en Store:
   - `ZENTRO_MSIX_PUBLISHER` — debe coincidir con el certificado de publicación (`CN=...`).
   - `ZENTRO_MSIX_PACKAGE_IDENTITY` — Package/Store identity (suele ser un GUID).
3. (Opcional) Para control total del manifest, copia `desktop/msix/Package.appxmanifest.example` → `desktop/msix/Package.appxmanifest` y edita `Identity`, `Publisher` y versión. El ejecutable debe ser `app\zentro.exe` (Forge coloca la app en la carpeta `app\`).

### Comandos

```powershell
# Solo MSIX x64 (salida: desktop\out\make\msix\x64\*.msix)
bun run desktop:make:msix

# Instaladores Windows (Squirrel + MSIX si estás en win32)
bun run desktop:make:win
```

Firma local (sideload o pruebas): define `ZENTRO_MSIX_SIGN=true` y certificado en `ZENTRO_MSIX_CERT_FILE` / `ZENTRO_MSIX_CERT_PASSWORD`. Para **Microsoft Store** no hace falta firmar el `.msix` antes de subirlo; Partner Center firma al publicar.

Depuración: `set DEBUG=electron-windows-msix*` (PowerShell) o `logLevel: debug` en `desktop/forge.msix.ts`.

### Microsoft Store (resumen)

1. Cuenta en [Microsoft Partner Center](https://partner.microsoft.com/dashboard).
2. Reserva el nombre de la app y anota **Package identity** y **Publisher**.
3. Alinea `Package.appxmanifest` (o las variables `ZENTRO_MSIX_*`) con esos valores.
4. Genera el `.msix` en Windows y súbelo en Partner Center → **Packages**.
5. Completa listado, políticas de privacidad y envía a certificación.

Documentación de referencia: [Electron Forge MSIX](https://www.electronforge.io/config/makers/msix), [Empaquetar Electron para Windows (Microsoft)](https://learn.microsoft.com/en-us/windows/apps/dev-tools/winapp-cli/guides/electron-packaging).

### CI (GitHub Actions)

El workflow `.github/workflows/desktop-msix.yml` compila en `windows-latest` y solo se dispara manualmente (Actions → Desktop MSIX → Run workflow). Configura en el repositorio:

| Tipo | Nombre | Uso |
|------|--------|-----|
| Variable | `ZENTRO_DESKTOP_WEB_URL` | URL web embebida en el build |
| Variable | `ZENTRO_MSIX_PUBLISHER` | Publisher de Store |
| Variable | `ZENTRO_MSIX_PACKAGE_IDENTITY` | Identity del paquete |
| Secreto | `ZENTRO_MSIX_CERT_*` | Solo si `ZENTRO_MSIX_SIGN=true` |

## Seguridad

- `nodeIntegration` está deshabilitado.
- `contextIsolation`, `sandbox` y `webSecurity` están activos.
- El preload solo expone `window.zentroDesktop` con metadatos mínimos y acciones acotadas para el splash (`getConnectionStatus`, `onConnectionStatus`, `retryConnection`).
- La navegación interna queda limitada al origen configurado; enlaces externos se abren en el navegador del sistema.
- Permisos sensibles se conceden solo al origen de Zentro.
- Electron inyecta una CSP básica cuando la respuesta web no trae una propia, evitando `unsafe-eval` en el wrapper desktop.
