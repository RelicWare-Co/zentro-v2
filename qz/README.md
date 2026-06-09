# QZ Tray — Impresión silenciosa (firma server-side)

Por defecto, QZ Tray muestra un popup ("¿Permitir esta solicitud?") cada vez que
la web intenta imprimir. Para eliminarlo necesitamos **firmar cada solicitud**
con una llave privada cuyo certificado QZ Tray reconozca como de confianza.

El flujo:

1. Generamos nuestro propio par **llave privada + certificado** (autofirmado).
2. El **servidor** firma cada solicitud con la llave privada
   (`/api/qz/sign`, RSA-SHA512). La llave nunca llega al navegador.
3. El **navegador** carga el certificado público desde `/api/qz/certificate` y
   se lo entrega a QZ Tray.
4. **QZ Tray** verifica la firma contra ese certificado. Si configuramos QZ Tray
   para confiar en él, imprime en silencio.

> Si los certificados no están configurados, todo sigue funcionando pero con el
> popup de QZ (modo *unsigned*). La firma es opcional y degrada con elegancia.

---

## 1. Generar los certificados

Requiere **OpenSSL** (Git for Windows ya lo trae).

```powershell
# Windows (PowerShell), desde la raíz del repo:
./qz/generate-certs.ps1

# Personalizando el subject:
./qz/generate-certs.ps1 -Subject "/CN=Zentro POS/O=Mi Empresa S.A.S/C=CO"
```

```bash
# macOS / Linux:
./qz/generate-certs.sh "/CN=Zentro POS/O=Mi Empresa S.A.S/C=CO"
```

Esto crea en `qz/certs/` (carpeta ignorada por git):

| Archivo | Qué es | Dónde va |
| --- | --- | --- |
| `private-key.pem` | Llave privada PKCS#8 | **Secreta** — solo en el servidor |
| `digital-certificate.txt` | Certificado X.509 | Público — lo sirve la app y lo confía QZ Tray |
| `public-key.txt` | Llave pública X.509 | Solo si más adelante pides un cert a una CA |

> ⚠️ **Nunca** subas `private-key.pem` al repo ni lo expongas al navegador.

---

## 2. Configurar el servidor

Apunta las variables de entorno a los archivos generados (en `.env`):

```dotenv
QZ_CERTIFICATE_PATH="./qz/certs/digital-certificate.txt"
QZ_PRIVATE_KEY_PATH="./qz/certs/private-key.pem"
# QZ_PRIVATE_KEY_PASSPHRASE=""   # solo si la llave tiene passphrase
```

O en plataformas donde no puedes montar archivos, pega el contenido PEM inline
(tiene prioridad sobre los `*_PATH`):

```dotenv
QZ_CERTIFICATE="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
QZ_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

Reinicia el servidor. Verifica que el certificado se sirve:

```
GET http://localhost:3000/api/qz/certificate   →  el contenido del cert
```

El endpoint `/api/qz/sign` requiere una **sesión autenticada** (es un "oráculo
de firma" y no debe quedar público).

---

## 3. Hacer que QZ Tray confíe en el certificado (quita el popup)

Un certificado autofirmado **no** es de confianza para QZ Tray hasta que se lo
indiques. Hay que hacerlo **en cada equipo** que tenga QZ Tray instalado.

### Opción A — Site Manager (interfaz gráfica, recomendado para pocos equipos)

1. Click derecho en el ícono de QZ Tray (bandeja del sistema) →
   **Advanced** → **Site Manager**.
2. Pestaña **Allowed** → **+** (agregar).
3. Selecciona el archivo `digital-certificate.txt`.
4. Guarda. A partir de ahí QZ Tray confía en cualquier solicitud firmada con la
   llave correspondiente, sin popup.

### Opción B — Override certificate (desplegable por archivo de propiedades)

Útil para automatizar en muchos equipos.

1. Copia `digital-certificate.txt` al equipo (p. ej. `C:\zentro\qz-cert.txt`).
2. Edita el archivo de propiedades de QZ Tray (normalmente
   `C:\Program Files\QZ Tray\qz-tray.properties`) y agrega:
   ```properties
   authcert.override=C:\\zentro\\qz-cert.txt
   ```
3. Reinicia QZ Tray.

> El "override" hace que QZ Tray trate ese certificado como raíz de confianza,
> de modo que cualquier solicitud firmada con su llave se acepta en silencio.

---

## 4. Probar

1. En la app: **Ajustes → Impresión local** → conexión **QZ**, busca y selecciona
   la impresora, activa **Usar impresora POS**, **Conectar**.
2. **Imprimir prueba**. Si configuraste todo bien, **no** aparece el popup de QZ.

Si todavía ves el popup:

- ¿El servidor sirve `/api/qz/certificate` con el cert correcto?
- ¿`digital-certificate.txt` que importaste en QZ Tray es el **mismo** que sirve
  el servidor? (Deben venir de la misma generación.)
- ¿Reiniciaste QZ Tray después de confiar el certificado?
- Revisa la consola del navegador: errores 401 en `/api/qz/sign` significan que
  la sesión no está autenticada.

---

## Rotación / regeneración

Si regeneras los certificados, debes **volver a confiar** el nuevo
`digital-certificate.txt` en cada equipo (paso 3) y actualizar el servidor
(paso 2). El par viejo deja de validar.
