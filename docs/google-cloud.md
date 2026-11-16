# Configurar Google Cloud para el modo Google Drive

Paso a paso para quien nunca lo hizo. Es **una sola vez** y gratis (no hace falta tarjeta ni activar facturación). Al final tenés un **ID de cliente** para la web y otro para Android. Son públicos por diseño (identifican a la app, no la protegen), pero igual no se commitean: van en `.env.google`.

La app pide **un solo permiso**, `drive.appdata` (la carpeta oculta de la app en el Drive de cada usuario). Google lo clasifica como **no sensible**: no hay auditoría de seguridad ni video de demostración.

> Los nombres de menú de Google cambian seguido. Hoy el área se llama **Google Auth Platform** y tiene las secciones **Branding**, **Audience** (Público), **Data Access** (Acceso a los datos) y **Clients** (Clientes). Si algo no coincide, buscalo en el buscador de arriba de la consola. Verificado contra la documentación de Google en 11/2026.

## 0. Antes de empezar

- Una cuenta de Google (la tuya sirve; no tiene que ser de empresa).
- La web pública ya publicada en GitHub Pages: `https://<tu-usuario>.github.io/study-workflow/` (la página de privacidad queda en `…/study-workflow/privacidad.html`). Google pide ambas direcciones.

## 1. Crear el proyecto

1. Entrá a <https://console.cloud.google.com/> con tu cuenta y aceptá los términos si te los muestra.
2. Arriba a la izquierda tocá el **selector de proyectos** › **Proyecto nuevo**.
3. Nombre: `Study Workflow`. Organización: "Sin organización". **Crear**.
4. Esperá unos segundos y elegí el proyecto nuevo en el selector.

## 2. Habilitar la Drive API

1. Menú ☰ › **APIs y servicios** › **Biblioteca**.
2. Buscá **Google Drive API** › **Habilitar**.

## 3. Pantalla de consentimiento (Google Auth Platform)

1. Menú ☰ › **APIs y servicios** › **Pantalla de consentimiento de OAuth** (te lleva a *Google Auth Platform*). Tocá **Comenzar**.
2. **Información de la app:** nombre `Study Workflow`, correo de asistencia al usuario (el tuyo). Siguiente.
3. **Público (Audience):** elegí **Externo**. Siguiente.
4. **Información de contacto:** tu correo. Siguiente, aceptá la política de datos de usuario de las APIs de Google y **Crear**.
5. Sección **Branding:**
   - **Página principal de la aplicación:** `https://<tu-usuario>.github.io/study-workflow/`
   - **Vínculo a la política de privacidad:** `https://<tu-usuario>.github.io/study-workflow/privacidad.html`
   - **Dominios autorizados:** agregá `github.io` si te deja. Si Google lo rechaza (es un dominio público compartido), dejalo vacío: para este permiso no es obligatorio.
   - **No subas logo.** Con logo, Google exige una verificación de marca (días o semanas). Sin logo no hace falta y el permiso funciona igual.
   - **Guardar.**
6. Sección **Acceso a los datos (Data Access)** › **Agregar o quitar permisos** › buscá `drive.appdata` (aparece como *"Ver y administrar sus propios datos de configuración en Google Drive"*, `…/auth/drive.appdata`), tildalo › **Actualizar** › **Guardar**. Tiene que quedar en la lista de **permisos no sensibles**. No agregues ninguno más.

## 4. Cliente OAuth para la web (GitHub Pages)

1. **Google Auth Platform** › **Clientes** › **Crear cliente**.
2. **Tipo de aplicación:** *Aplicación web*. Nombre: `Study Workflow web`.
3. **Orígenes autorizados de JavaScript** › **Agregar URI:** `https://<tu-usuario>.github.io` (solo el origen: **sin** `/study-workflow` y sin barra final).
4. **No agregues URI de redireccionamiento:** el login usa una ventana emergente y no los necesita.
5. **Crear.** Copiá el **ID de cliente** (termina en `.apps.googleusercontent.com`). El *secreto del cliente* **no se usa**: no lo copies a ningún lado.
6. Pegalo en `.env.google` (copiá `.env.google.example`):
   ```
   GOOGLE_WEB_CLIENT_ID=123456789-abc.apps.googleusercontent.com
   ```
7. Cambios en los orígenes pueden tardar de unos minutos a unas horas en aplicar.

> Tu web en tu server (la de Tailscale) **no usa Drive**: sigue con "Mi servidor". Por eso no se agrega su dirección como origen.

## 5. Cliente OAuth para Android (etapa del APK)

Hacelo cuando lleguemos al APK; queda acá para tenerlo todo junto. Hace falta uno **por paquete + llave de firma**:

| App | Paquete | Llave |
|---|---|---|
| APK personal y del Release | `ar.federico.studyworkflow` | la de `release.jks` (la misma firma los dos) |
| Versión de prueba (`--next`) | `ar.federico.studyworkflow.next` | la misma llave |

1. Sacá el **SHA-1** de tu llave de firma (la carpeta es `%USERPROFILE%\.study-workflow\`; la clave está en `keystore.properties`):
   ```
   keytool -list -v -keystore "%USERPROFILE%\.study-workflow\release.jks" -alias study-workflow
   ```
   Copiá la línea `SHA1:` (formato `AB:CD:…`).
2. **Clientes** › **Crear cliente** › tipo **Android**. Nombre: `Study Workflow Android`. **Nombre del paquete:** `ar.federico.studyworkflow`. **Huella digital del certificado SHA-1:** la del paso anterior. **Crear.**
3. Repetí con `ar.federico.studyworkflow.next` si querés probar Drive en la versión de prueba.
4. El APK **no lleva ningún ID en el código**: Google lo reconoce por paquete y huella.

> Si algún día perdés `release.jks` o cambiás de llave, hay que crear el cliente Android de nuevo con el SHA-1 nuevo.

## 6. Publicar la app a producción

Mientras la app está en **Prueba**, el permiso de cada usuario **vence a los 7 días** y solo entran los usuarios de la lista. Hay que publicarla.

1. **Google Auth Platform** › **Público (Audience)** › **Estado de publicación** › **Publicar la aplicación** › **Confirmar**.
2. Si dice que falta completar algo, es la sección **Branding** (paso 3.5): completá nombre, correo y los dos links.
3. El estado tiene que pasar a **En producción**. Como el permiso es no sensible y no hay logo, **no pide verificación**. Los usuarios verán la pantalla normal de permiso de Google, con el nombre de proyecto en lugar del nombre y logo de la app (eso es lo que pasa sin verificar la marca).

## 7. Probar

1. `npm run pages` arma el sitio con el ID (si falta, avisa) y lo audita; `npm run pages -- --publish` lo sube a la rama `gh-pages`.
2. En GitHub: **Settings** › **Pages** › *Source*: **Deploy from a branch** › rama `gh-pages`, carpeta `/ (root)`. Esperá un minuto.
3. Abrí `https://<tu-usuario>.github.io/study-workflow/` › Ajustes › **Google Drive** › **Conectar**. Tiene que aparecer la ventana de Google pidiendo **un solo** permiso (la carpeta de datos de la app).
4. Revisá que en tu Drive aparezca el uso en <https://drive.google.com/drive/settings> › **Administrar aplicaciones**.

## Problemas comunes

| Mensaje | Qué pasa |
|---|---|
| `Error 400: origin_mismatch` | El origen de la web no está en *Orígenes autorizados de JavaScript* (paso 4.3), o todavía no se propagó. |
| `Error 403: access_denied` y "la app no completó la verificación" | La app sigue en **Prueba**: publicala (paso 6) o agregá tu cuenta en *Usuarios de prueba*. |
| Pide volver a entrar cada 7 días | Sigue en Prueba. |
| La ventana de Google no se abre o se cierra sola | El navegador bloqueó el popup: permitilo para el sitio y tocá **Reconectar**. |
| Pide reconectar cada ~1 hora en la web | Es un límite de Google: en el navegador el permiso dura 1 hora y renovarlo necesita un toque. En el APK se renueva solo. |
