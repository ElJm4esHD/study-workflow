# La app en el celu (Windows 11 → Samsung S25 Ultra)

Todo se hace desde esta compu, en una terminal abierta en la carpeta del proyecto.

## 1. Verificar que está todo

Android Studio ya está instalado (trae el JDK y el SDK de Android). Corré:

```
npm run apk -- --check
```

Tiene que mostrar ✔ en JDK y en Android SDK. La llave de firma puede decir "todavía no existe": se crea sola en el paso 2.

Si algo sale con ✖: abrí Android Studio, terminá el asistente de bienvenida ("Standard") y volvé a probar. No hace falta instalar nada más a mano: lo que falte del SDK se baja solo en el primer build.

## 2. Compilar

```
npm run apk
```

- La primera vez tarda varios minutos (baja cosas de internet). Las siguientes, alrededor de un minuto.
- La primera vez crea la llave de firma en `%USERPROFILE%\.study-workflow\` y te avisa. **Hacele backup** (ver paso 6).
- Al final muestra dónde quedó el archivo: `dist\study-workflow.apk`, dentro de la carpeta del proyecto.

## 3. Pasar el APK al celu

Elegí uno de los dos caminos.

### Camino A: copiar por cable

1. Conectá el S25 a la compu con el cable USB. En el celu, si pregunta, elegí "Transferir archivos".
2. En el Explorador de Windows abrí el celu → `Download` y copiá ahí `dist\study-workflow.apk`.
3. En el celu abrí **Mis archivos** → **Descargas** y tocá `study-workflow.apk`.
4. La primera vez Android dice que no permite instalar apps de esta fuente: tocá **Ajustes** y activá **Permitir de esta fuente** para Mis archivos. Volvé atrás y tocá **Instalar**.
5. Si aparece Play Protect, elegí **Instalar de todas formas** (es tu app, no está en la Play Store).

### Camino B: adb (más cómodo para actualizar)

Una sola vez, en el celu:

1. **Ajustes → Acerca del teléfono → Información de software** y tocá 7 veces **Número de compilación**. Aparecen las **Opciones de desarrollador**.
2. **Ajustes → Opciones de desarrollador** y activá **Depuración USB**.
3. Conectá el cable. En el celu aparece "¿Permitir depuración USB?": marcá "Permitir siempre desde esta computadora" y aceptá.

Cada vez que quieras instalar o actualizar, en la terminal:

```
%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe install -r dist\study-workflow.apk
```

(En PowerShell es `& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r dist\study-workflow.apk`.) Tiene que decir `Success`.

## 4. Primera apertura

1. Prendé **Tailscale** en el celu.
2. Abrí **Study Workflow**. Pide la dirección del servidor; ya viene puesta la de tu `.env.deploy` (`https://DEPLOY_HOST:HTTPS_PORT`, por ejemplo `https://tu-server.tu-tailnet.ts.net:8443`). Si compilaste sin `.env.deploy` o bajaste el APK de GitHub Releases (`npm run apk:public`), escribila a mano.
3. Tocá **Probar y guardar**. Si anda, entra a Inicio.

La dirección se cambia después en Ajustes → Servidor.

## Compartir un plan desde la app de Claude

1. En la app de Claude (o cualquier app), tocá **Compartir** en el mensaje con el plan.
2. Elegí **Study Workflow**.
3. Se abre **Importar** con el texto ya pegado en el campo. Tocá **Vista previa** para revisarlo: no se guarda nada hasta que confirmes.

Anda con la app cerrada o abierta. Si es la primera vez, antes te pide la dirección del servidor.

## Widget To-do

1. Abrí la app una vez (el widget lee los datos que la app guarda en el celu; no necesita conexión para mostrarlos).
2. Mantené apretada la pantalla de inicio → **Widgets** → **Study Workflow** → arrastrá "To-do". Para redimensionarlo, mantenelo apretado y tirá de los bordes.
3. **Batería (importante en Samsung):** **Ajustes → Aplicaciones → Study Workflow → Batería → Sin restricciones**. Sin esto, One UI puede frenar los refrescos y la sincronización de los tildes hechos sin señal.

Se redibuja al instante cuando cambia algo en la app o al tildar desde el widget (el tilde se guarda en el celu en el momento). Los cambios se suben al servidor y se bajan los de la compu en segundo plano: al tildar, al volver la red y cada 30 minutos con el widget puesto. Si la misma tarea se cambió en dos dispositivos, gana el cambio más nuevo.

Si un tilde sin señal no se sube: revisá la batería "Sin restricciones"; igual no se pierde, queda guardado en el celu hasta que haya conexión.

Las tareas con subtareas muestran el progreso (`2/4`); tildar en el widget completa la tarea principal.

El widget Agenda ya no existe. Si lo tenías puesto, después de actualizar queda como "No se puede cargar el widget": mantenelo apretado y quitalo.

## Recordatorios

En una tarea con fecha o en un evento, elegí **Recordatorio**: a la hora, 15 min, 1 h o 1 día antes, o "Otro…" (minutos, horas o días). Se puede poner desde la compu o desde el celu; suena en el celu.

- **Permisos:** la primera vez que ponés uno desde el celu, Android pide permiso de **notificaciones**: aceptalo. Si lo rechazaste: Ajustes → Aplicaciones → Study Workflow → Notificaciones.
- **Sonido:** usa el tono y el **volumen de alarma** del celu, así que suena aunque esté en silencio o vibración. Con **Insistente** se repite hasta que bajes la barra de notificaciones o la descartes. El tono se cambia en Ajustes → Aplicaciones → Study Workflow → Notificaciones → Recordatorios.
- **Sin hora** (tarea con fecha sola o evento de todo el día) se toma las 09:00 como base.
- **Eventos que se repiten:** suena en cada ocurrencia.
- Funciona sin conexión, con la app cerrada y después de reiniciar el celu. Tocar la notificación abre la tarea o el día.
- Al completar o borrar la tarea, o sacarle la fecha, el recordatorio se cancela solo.
- **Cuándo se entera el celu:** al cambiar algo en la app del celu, al instante. Si lo pusiste desde la compu, en la próxima sincronización: al abrir la app o en el sync de fondo (cada 30 minutos con el widget To-do puesto). Se programan los 60 más próximos dentro de los próximos 30 días.
- **Batería:** necesita "Sin restricciones", igual que el widget (paso 3 de arriba).
- Si el celu estaba apagado a la hora del recordatorio, ese no suena.

## Tema

El tema que elegís en Ajustes › Apariencia también lo usan el widget y, desde Android 12, la pantalla de arranque (la app fija su propio modo claro/oscuro con `UiModeManager`, que el sistema recuerda). Si elegís "Según el sistema", el widget cambia solo cuando el celu cambia de modo.

## 5. Actualizar

Volvé a correr `npm run apk` e instalá el APK nuevo encima del viejo (camino A o B). No hace falta desinstalar: tus datos están en el servidor y la app sigue configurada.

## 6. Backup de la llave de firma

Copiá la carpeta `%USERPROFILE%\.study-workflow\` (tiene `release.jks` y `keystore.properties`) a un pendrive o a tu nube. Para abrirla, pegá esa ruta en la barra del Explorador.

Si la perdés, el próximo APK va a tener otra firma y Android no lo deja instalar encima: hay que desinstalar la app e instalarla de nuevo. No perdés datos (están en el servidor), ni los datos del servidor, pero sí lo que el celu todavía no había subido y la dirección guardada. Para recuperar la llave, poné la carpeta de vuelta en el mismo lugar antes de compilar.

## 7. Problemas comunes

- **"App no instalada"** o **"el paquete entra en conflicto"**: el APK nuevo tiene otra firma que el instalado (por ejemplo, perdiste la llave o compilaste en otra compu). Desinstalá Study Workflow del celu e instalá de nuevo. Con adb, el error dice `INSTALL_FAILED_UPDATE_INCOMPATIBLE`.
- **"No pude conectar con el servidor. ¿Tailscale está prendido en el celu?"**: abrí Tailscale y fijate que diga conectado. Probá abrir `https://tu-server.tu-tailnet.ts.net:8443` en Chrome del celu: si ahí tampoco anda, el problema es el servidor o Tailscale, no la app.
- **Error de certificado o de puerto**: la dirección tiene que empezar con `https://`, terminar en `.ts.net` y llevar el puerto `:8443`. Con la IP (`192.168.x.x`) no anda, porque el certificado es para el nombre `.ts.net`.
- **adb dice `no devices` o `unauthorized`**: revisá el cable, que la Depuración USB esté activada y que hayas aceptado el aviso en el celu. Desenchufá y volvé a enchufar.
- **`npm run apk` falla**: corré `npm run apk -- --check` y seguí lo que diga. Si falla en Gradle la primera vez, revisá que haya internet y volvé a correrlo.
