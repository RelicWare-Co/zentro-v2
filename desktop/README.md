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

## Seguridad

- `nodeIntegration` está deshabilitado.
- `contextIsolation`, `sandbox` y `webSecurity` están activos.
- El preload solo expone `window.zentroDesktop` con metadatos mínimos.
- La navegación interna queda limitada al origen configurado; enlaces externos se abren en el navegador del sistema.
- Permisos sensibles se conceden solo al origen de Zentro.
- Electron inyecta una CSP básica cuando la respuesta web no trae una propia, evitando `unsafe-eval` en el wrapper desktop.
