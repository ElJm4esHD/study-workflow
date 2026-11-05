# Fase 2: APK con Capacitor

Fecha: 05/11/2026. Va después del Hito C (deployado y probado) y antes de la Fase 3 (widgets).
Marcas: **[usuario]** = lo decidió Federico (en CLAUDE.md o en la charla). **[mía]** = decisión mía, revisable.

## 1. Por qué y qué es éxito

Federico usa la app sobre todo en el S25 Ultra. Hoy la abre en el navegador y depende de tener señal y Tailscale andando. **[usuario]** Quiere una app instalada propia que abra siempre, aunque no haya conexión, y que se pueda elegir desde el menú "Compartir" para mandarle el plan que arma Claude.

**Éxito:**
- Con un comando en la compu sale un APK firmado.
- Se instala en el S25 siguiendo una guía paso a paso.
- Abre sin conexión con lo último que vio.
- Deja tildar tareas sin señal y las sincroniza sola al volver.
- Desde Claude, "Compartir → Study Workflow" abre Importar con el texto ya pegado.

## 2. Objetivos, no-objetivos, anti-objetivos

**Objetivos**
- APK Android con Capacitor que trae el frontend adentro. **[usuario]**
- URL del servidor configurable. **[usuario]**
- Copia offline de lo último que trajo el servidor. **[usuario]**
- Sin conexión, solo se puede tildar y destildar tareas. Esos cambios se encolan y se sincronizan al reconectar. **[usuario]** Esto reemplaza el "las modificaciones se encolan" de CLAUDE.md, que era más amplio.
- Aparecer en el menú "Compartir" para recibir texto y abrir Importar. **[usuario]**
- CORS en el backend para el origen de Capacitor. **[usuario]**
- Script de un comando para compilar el APK firmado. **[usuario]**
- Guía para Windows desde cero: Android Studio, SDK y JDK, y cómo pasar e instalar el APK en el S25. **[usuario]**

**No-objetivos**
- Widgets: son la Fase 3. Sí hay que dejar el proyecto Android listo para sumarlos (proyecto nativo en el repo).
- Play Store, iOS y notificaciones.
- Editar, crear o borrar sin conexión. Importar, Ajustes, materias y eventos necesitan conexión. **[usuario]**
- Actualización automática del APK: para actualizar, se compila e instala de nuevo.

**Anti-objetivos**
- Que la app cargue la UI desde el servidor. Tiene que traerla adentro. **[usuario]**
- Perder un tilde hecho sin señal, o que un tilde viejo pise un cambio más nuevo hecho desde la compu. **[usuario]** (gana la última escritura)
- Exponer el servidor fuera del tailnet. El acceso sigue siendo solo por Tailscale.
- Servicios de terceros o costos.

## 3. Constraints

- **Stack:** Capacitor 8 (la versión actual; consultar Context7 al implementar). Android Studio ≥ 2025.2.1, que trae el JDK; no hace falta instalarlo aparte.
- **Origen de la app en Android:** `https://localhost`, el default de Capacitor con `androidScheme: 'https'`. El backend acepta CORS solo de ese origen, además del propio.
- El servidor se accede con `https://tu-server.tu-tailnet.ts.net:8443`, que es `HTTPS_PORT` de `.env.deploy`, con el certificado `*.ts.net` de Tailscale. El celu tiene que tener Tailscale prendido.
- **Arquitectura modular intacta:** caché y cola viven en el núcleo (`core/web/api.ts`). Los módulos no saben si están en el APK, salvo lo mínimo que marca este documento.
- **Dependencias nuevas, justificadas:**
  - `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`: el runtime y el proyecto Android.
  - `@capacitor/app`, solo si Context7 confirma que hace falta para que el botón "Atrás" de Android navegue el historial en vez de cerrar la app.
  - Nada más. Sin plugin de red, sin plugin de storage, sin plugin de compartir (ver 5.4).
- Todo en español (Argentina). Tema oscuro del Hito C. Zonas táctiles ≥ 44–48 px.

## 4. Experiencia

### Primera vez
- La app abre en una pantalla "Conectar con tu servidor".
- Tiene un campo con la URL, precargado con `https://tu-server.tu-tailnet.ts.net:8443`, y un botón "Probar y guardar" que llama a `/api/health`.
- Si la prueba falla, el error tiene que decir qué revisar ("¿Tailscale está prendido en el celu?").
- Si anda, guarda la URL y entra a Inicio.
- La URL se puede cambiar después en Ajustes → "Servidor". Esa sección solo existe en el APK. **[mía]**

### Con conexión
Funciona igual que la web. Cada respuesta `GET /api/*` exitosa se guarda como la última copia.

### Sin conexión
- **Cuándo cuenta como sin conexión:** cuando una llamada al servidor falla por red o por timeout de 8 s. **[mía]** Eso incluye el modo avión y también el caso de Tailscale caído o el servidor apagado.
- **Aviso:** se muestra arriba, fijo y sin tapar contenido: "Sin conexión. Datos del dd/mm hh:mm." Si hay tildes en cola, agrega ", N cambios por sincronizar".
- **Lectura:** las pantallas muestran la última copia de cada pantalla que se haya abierto con conexión. Si una pantalla nunca se abrió con conexión, aparece el error de siempre, con el texto "Sin conexión y sin datos guardados para esta pantalla.". **[mía]**
- **Prefetch al abrir con conexión** **[mía]**, para que la copia esté completa aunque nunca hayas entrado a esas pantallas:
  - `/api/todo`
  - `/api/materias`
  - `/api/settings`
  - la agenda de hoy − 7 a hoy + 60 días
- **Tildar:** el checkbox funciona igual que con conexión (en To-do, en el detalle del día y en la tarjeta Hoy). El cambio se ve al instante en todas las pantallas.
- **Todo lo demás está desactivado:** agregar, editar, borrar, reordenar, Importar y Ajustes. Si se intenta, aparece "Sin conexión: solo podés tildar tareas." Los botones pueden verse deshabilitados o avisar al tocar; lo decide el builder, pero tiene que ser consistente.

### Al volver la conexión
- **Disparadores:**
  - la próxima llamada que funcione;
  - el evento `online`;
  - cada 30 s mientras esté offline;
  - al volver la app a primer plano.
- **Orden de la sincronización:**
  1. Se manda la cola en orden.
  2. Se vuelve a pedir todo lo cacheado.
  3. Desaparece el aviso.
- **Última escritura gana** **[usuario]**:
  - Cada tilde encolado guarda la hora en que se hizo.
  - Antes de mandarlo, se pide `GET /api/todo/:id`.
  - Si el `updatedAt` del servidor es posterior a esa hora, el tilde se descarta, porque desde la compu hubo un cambio más nuevo.
  - Si la tarea ya no existe (404), se descarta.
  - Cualquier otro error deja el tilde en la cola para el próximo intento.
- **Varios tildes de la misma tarea:** se colapsan en el último. **[mía]**
- **Persistencia:** la cola y la copia se guardan en el WebView con `localStorage`. **[mía]** Los datos son chicos, son de un solo usuario y quedan en los datos de la app. Sobreviven a cerrar la app y a reiniciar el celu.

### Compartir → Study Workflow
- El APK aparece en el menú Compartir de Android para texto (`text/plain`).
- Al compartir, la app abre directo en Importar con el texto en el campo de pegar. El usuario toca "Vista previa" como siempre: nada se guarda sin confirmar.
- Funciona tanto con la app cerrada como abierta.
- Si no hay conexión, Importar muestra el aviso de sin conexión. El texto queda en el campo, para no perderlo.

### Botón "Atrás" de Android
Navega el historial de la app y cierra el detalle del día, como en el navegador. En la pantalla raíz cierra la app.

### Aspecto
- Ícono y nombre: "Study Workflow". El ícono es simple, generado a mano como vector adaptativo, sin herramientas nuevas. **[mía]**
- Pantalla de carga con el fondo `--bg`.
- Barras del sistema oscuras.
- El contenido respeta las zonas seguras (notch, barra de gestos) del S25, con edge-to-edge de Android 15 y los insets de Capacitor 8 (`SystemBars`).

## 5. Cómo se arma (decisiones técnicas)

### 5.1 Proyecto
- `capacitor.config.ts` en la raíz. `appId` = `ar.federico.studyworkflow` **[mía]**. `webDir` es el build de Vite que ya existe.
- El proyecto nativo queda en `android/`, commiteado, porque la Fase 3 suma ahí los widgets. Lo generado que no hace falta versionar va al `.gitignore`, según la guía de Capacitor.
- **Mismo frontend:** `core/web/api.ts` arma las URLs con `serverUrl + path` cuando corre nativo (`Capacitor.isNativePlatform()`). En la web siguen relativas.

### 5.2 CORS en el backend
- Un hook en el núcleo agrega `Access-Control-Allow-Origin: https://localhost`, con los métodos y headers que usa la API, solo para ese origen.
- Responde el preflight `OPTIONS`.
- No suma dependencia; si `@fastify/cors` resultara más simple y seguro, se justifica en el plan.
- Lleva test.
- Deja el punto de enganche de auth como está.

### 5.3 Caché y cola (núcleo)
- **En `core/web/api.ts`:**
  - Cada GET exitoso se guarda con su URL como clave.
  - Si un GET falla por red, devuelve la copia guardada, marcada como "offline".
  - Si un no-GET falla por red, tira `ApiError('sin_conexion', 'Sin conexión: solo podés tildar tareas.')`, salvo que sea encolable.
- **Encolable** = `PATCH /api/todo/:id` cuyo cuerpo es solo `{ completed }`.
  - Lo marca el núcleo por forma, sin conocer el módulo por dentro. **[mía]**
  - Es un solo caso, a propósito.
  - Al encolar, se parchea en todas las copias guardadas el objeto con ese `id` (`completed` y `completedAt`), así las otras pantallas lo ven tildado.
- **Estado de conexión:** el núcleo expone `offline` y la cantidad de pendientes, por ejemplo en `useCore()`, para el aviso y para que las pantallas deshabiliten acciones.
- **Tests:** la lógica de la cola tiene tests sin React: colapsar, última escritura gana, 404 y reintento.

### 5.3 bis Detalles de la caché y la cola **[mía]**
- **Agenda:** cada vista del calendario pide su propio rango, así que una caché por URL casi nunca acertaría.
  - El módulo Calendario precarga un rango ancho: hoy − 42 a hoy + 120 días, que cubre el mes ± 1 y las tarjetas de Inicio.
  - Sin conexión, cualquier rango pedido se arma filtrando esa copia: eventos que se cruzan con el rango y to-dos por `dueDate`.
  - Para eso el núcleo expone una lectura de la copia guardada, por ejemplo `cached(url)`.
- **Parcheo al encolar:** se recorren las copias y se cambia `completed` y `completedAt` en todo objeto con ese `id` que tenga la clave `completed`.
  - Los ids son UUID, así que no chocan con los de eventos.
  - Hoy y Vencidas se calculan en el cliente desde `/api/todo`, así que la tarea cambia de lista sola.
- **Última escritura gana, sin depender del reloj del celu:** al encolar se guarda el `updatedAt` que tenía la tarea en la copia. Al sincronizar, si el `updatedAt` del servidor es distinto, alguien la cambió después y el tilde se descarta.
- **Reordenar y cualquier otro PATCH** que no sea solo `{ completed }` se rechaza offline.
- **Timeout de 8 s:** solo en los GET. Los demás métodos usan 30 s, para no cortar una importación lenta.
- **Texto compartido con la app cerrada:** se guarda hasta que la web lo pide.
  - Si es la primera vez, sobrevive a la pantalla "Conectar" y después abre Importar.
  - Se pasa por evento o llamada del bridge, nunca en la URL, porque un mensaje de Claude puede ser largo.
- **CORS:** solo `https://localhost`. Mismo build y misma config de Vite, con rutas desde `/`.
- **`versionCode`:** minutos desde el 01/01/2026 UTC. Entra en el límite de Android y permite varios builds por día. La clave del keystore va en un archivo de propiedades al lado del keystore, fuera del repo; alcanza para un solo usuario.
- **Android Studio:** se instala en esta misma compu. Las tareas nativas verifican `assembleRelease` si ya está instalado; si no, quedan marcadas como "sin verificar hasta instalarlo".

### 5.4 Compartir sin plugin de terceros
- **[mía]** No usar un plugin de "share target" de terceros: los que hay suelen ir atrasados respecto de Capacitor 8.
- Se hace con un `intent-filter` `ACTION_SEND` `text/plain` en el `AndroidManifest.xml`, y unas pocas líneas en `MainActivity` (Kotlin) que leen `EXTRA_TEXT` en `onCreate` y `onNewIntent`.
- La `MainActivity` se lo pasa a la web, por ejemplo con un evento JS del bridge o navegando a `/importar` con el texto. El builder elige el mecanismo con la doc de Capacitor 8 y lo prueba.
- Importar lee ese texto y lo pone en el campo.
- Es el mismo terreno nativo que la Fase 3.

### 5.5 Firma y build
- **Comando:** `npm run apk`. Hace el build web, `npx cap sync android` y `gradlew assembleRelease`, y copia el resultado a `dist/study-workflow.apk`.
- **JDK:** el script encuentra solo el que trae Android Studio, en `C:\Program Files\Android\Android Studio\jbr`, o usa `JAVA_HOME` si ya existe. Si falta algo, dice qué instalar, con un link a la guía.
- **Firma de release** **[mía]**:
  - Usa un keystore propio que vive **fuera del repo**, en `%USERPROFILE%\.study-workflow\release.jks`.
  - Si no existe, el script lo crea la primera vez con `keytool`, y la clave queda en un archivo de propiedades al lado.
  - La guía avisa que hay que hacerle backup: si se pierde, para actualizar hay que desinstalar e instalar de nuevo. Eso solo borra la copia offline, porque los datos están en el servidor.
  - Se elige release y no debug porque es más liviano y la firma no depende de la compu.
- **Versión:** `versionCode` y `versionName` salen de `package.json` o de la fecha, para que cada APK nuevo se instale encima del anterior. **[mía]**

### 5.6 Guía de instalación (`docs/android.md`)
Paso a paso para Windows 11 y para Federico, que no tiene nada instalado:
1. Instalar Android Studio desde developer.android.com y pasar el asistente "Standard". Eso baja el SDK y el JDK. Indicar qué componentes del SDK Manager hacen falta para la versión de Android que usa Capacitor 8.
2. Verificar con un comando que el script encuentra todo (`npm run apk -- --check` o equivalente).
3. `npm run apk` y dónde queda el archivo.
4. **Pasar el APK al S25**, con dos caminos:
   - **(a) Cable USB:** copiar `study-workflow.apk` a Descargas, abrirlo desde "Mis archivos" y permitir "Instalar apps desconocidas" para Mis archivos.
   - **(b) adb:** activar Opciones de desarrollador y Depuración USB, y correr `adb install -r`, cómodo para las actualizaciones.
5. **Primera apertura:** Tailscale prendido, URL del servidor, probar.
6. **Actualizar:** recompilar e instalar encima.
7. **Problemas comunes:** "App no instalada" por una firma distinta, que Tailscale esté apagado, y certificado o puerto.

También va un resumen en el README.

## 6. Calidad

- **TDD:** CORS en el backend, y la cola y la caché en `core/web`. UI: lo justo.
- **Prueba en el celu real:** la hace Federico con la checklist del final. Los builders verifican lo que puedan en la compu (build web, tests, `assembleRelease` si Android Studio ya está instalado).
- **Sin pantallas en blanco:** sin conexión y sin copia, aparece un error claro.

## 7. Queda para el que construye

- El mecanismo exacto MainActivity → web para el texto compartido, verificado con Context7.
- Si hace falta `@capacitor/app` para el botón Atrás.
- Cómo se ven las acciones deshabilitadas offline (consistente en toda la app).
- Detalles del ícono y del splash dentro del tema.
- Cómo partir el trabajo en tareas. La parte nativa y el `assembleRelease` requieren que Android Studio ya esté instalado: el plan pone primero lo que no lo necesita.

## 8. Al terminar

Frenar. Pasarle a Federico:
- la checklist de prueba en el S25;
- el comando para compilar e instalar;
- el recordatorio del backup del keystore.

No arrancar la Fase 3 sin su OK.
