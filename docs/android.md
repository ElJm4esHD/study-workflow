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
2. Abrí **Study Workflow**. Pide la dirección del servidor; ya viene puesta `https://tu-server.tu-tailnet.ts.net:8443`.
3. Tocá **Probar y guardar**. Si anda, entra a Inicio.

La dirección se cambia después en Ajustes → Servidor.

## 5. Actualizar

Volvé a correr `npm run apk` e instalá el APK nuevo encima del viejo (camino A o B). No hace falta desinstalar: tus datos están en el servidor y la app sigue configurada.

## 6. Backup de la llave de firma

Copiá la carpeta `%USERPROFILE%\.study-workflow\` (tiene `release.jks` y `keystore.properties`) a un pendrive o a tu nube. Para abrirla, pegá esa ruta en la barra del Explorador.

Si la perdés, el próximo APK va a tener otra firma y Android no lo deja instalar encima: hay que desinstalar la app e instalarla de nuevo. No perdés datos (están en el servidor), solo la copia sin conexión y la dirección guardada. Para recuperar la llave, poné la carpeta de vuelta en el mismo lugar antes de compilar.

## 7. Problemas comunes

- **"App no instalada"** o **"el paquete entra en conflicto"**: el APK nuevo tiene otra firma que el instalado (por ejemplo, perdiste la llave o compilaste en otra compu). Desinstalá Study Workflow del celu e instalá de nuevo. Con adb, el error dice `INSTALL_FAILED_UPDATE_INCOMPATIBLE`.
- **"No pude conectar con el servidor. ¿Tailscale está prendido en el celu?"**: abrí Tailscale y fijate que diga conectado. Probá abrir `https://tu-server.tu-tailnet.ts.net:8443` en Chrome del celu: si ahí tampoco anda, el problema es el servidor o Tailscale, no la app.
- **Error de certificado o de puerto**: la dirección tiene que empezar con `https://`, terminar en `.ts.net` y llevar el puerto `:8443`. Con la IP (`192.168.x.x`) no anda, porque el certificado es para el nombre `.ts.net`.
- **adb dice `no devices` o `unauthorized`**: revisá el cable, que la Depuración USB esté activada y que hayas aceptado el aviso en el celu. Desenchufá y volvé a enchufar.
- **`npm run apk` falla**: corré `npm run apk -- --check` y seguí lo que diga. Si falla en Gradle la primera vez, revisá que haya internet y volvé a correrlo.
