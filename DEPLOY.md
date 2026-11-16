# Primer deploy y pruebas — paso a paso

Guía para subir la app al server por primera vez, desde la laptop con Windows y PowerShell, y probarla.
Todos los comandos se corren en PowerShell dentro de `C:\PROYECTS\study-workflow`, salvo que diga otra cosa.

- **Server:** `tu-server.tu-tailnet.ts.net` (usuario `tu-usuario`).
- **Puertos:** la app escucha en `127.0.0.1:8110` en el server y se publica en `https://tu-server.tu-tailnet.ts.net:8443`.
- **Dónde se configura:** host y puertos salen **solo** de `.env.deploy`. No se commitea y ya está creado. Si cambiás un puerto, cambialo ahí y nada más.
- **Lo que no se toca:** cualquier otra app que ya tengas en el server (puertos ocupados o publicada con `tailscale serve`). Revisalo en el paso 1.4.

---

## 0. Probar en local (opcional, 2 minutos)

```
npm install
npm run dev
```

Abrí `http://localhost:5173`, creá una tarea y cerralo con Ctrl+C. Los datos viven en el navegador (IndexedDB) y se sincronizan con el server local de `./data/sync.sqlite`; no son los de tu server real.

---

## 1. Preparar el acceso (una sola vez)

### 1.1 HTTPS en Tailscale
En https://login.tailscale.com/admin/dns tienen que estar activados **MagicDNS** y **HTTPS Certificates**. Si otra app tuya ya anda por HTTPS, seguramente ya lo están.

### 1.2 Clave SSH
```
ssh-keygen -t ed25519
```
Apretá Enter a todo. Si dice que ya existe, contestá `n` y seguí.

```
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh tu-usuario@tu-server.tu-tailnet.ts.net "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```
Te pide la contraseña del server por última vez. Después probá:

```
ssh tu-usuario@tu-server.tu-tailnet.ts.net echo ok
```
Tiene que responder `ok` **sin** pedir contraseña.

### 1.3 Chequeos en el server
```
ssh tu-usuario@tu-server.tu-tailnet.ts.net "id -u; ss -ltn | grep ':8110 '; tailscale serve status"
```
- La primera línea tiene que ser `1000`.
- `ss` no tiene que mostrar nada para `:8110`. Si muestra algo, ese puerto está ocupado: elegí otro en `.env.deploy`.
- `tailscale serve status` muestra lo que ya está publicado. Pueden aparecer otras apps tuyas (por ejemplo en `:443`), pero **nada en `:8443`**. Si te pide permisos, corrélo con `ssh -t ... sudo tailscale serve status`.

### 1.4 Revisar `.env.deploy`
```
notepad .env.deploy
```
Tiene que decir:
```
DEPLOY_HOST=tu-server.tu-tailnet.ts.net
DEPLOY_USER=tu-usuario
PORT=8110
HTTPS_PORT=8443
```

---

## 2. Preparar el server (una sola vez)

### 2.1 Setup
```
npm run server-setup
```
Crea `~/git/study-workflow.git`, `~/apps/study-workflow/` y `/srv/study-workflow/backups`. Se puede correr varias veces sin romper nada.

Si dice `FALTA: crear /srv/study-workflow...`, corré esto y después repetí `npm run server-setup` hasta que diga `OK`:
```
ssh -t tu-usuario@tu-server.tu-tailnet.ts.net "sudo mkdir -p /srv/study-workflow/backups && sudo chown -R 1000:1000 /srv/study-workflow"
```

Al final imprime el comando de `tailscale serve`, que tiene que ser con `--https=8443` y `127.0.0.1:8110`.

### 2.2 Publicar con HTTPS (solo el puerto 8443)
```
ssh -t tu-usuario@tu-server.tu-tailnet.ts.net "sudo tailscale serve --bg --https=8443 http://127.0.0.1:8110"
```
Esto **agrega** el 8443 y no toca lo que ya tengas publicado en otros puertos. Para confirmarlo:
```
ssh -t tu-usuario@tu-server.tu-tailnet.ts.net "sudo tailscale serve status"
```
Tiene que aparecer study-workflow en `:8443`, junto a lo que ya tenías.

---

## 3. Deploy

```
npm run deploy
```
- Solo deploya desde la rama `main` y sin cambios sin commitear.
- La primera vez tarda unos minutos porque arma la imagen de Docker.
- Tiene que terminar en `✔ Deploy OK (xxxxxxx)`.
- Si sale `✖ Deploy FALLÓ`, copiá **toda** la salida y pasámela. Es la primera vez que se arma el contenedor de verdad.

Abrí **https://tu-server.tu-tailnet.ts.net:8443** en la compu y en el celu, con Tailscale prendido en el celu.

Si tenías otras apps publicadas, revisá que sigan andando.

---

## 4. Qué probar

- [ ] **Materias.** En Ajustes, creá 2 o 3 materias con color, editá una y archivá otra. Mirá que los colores se lean bien en claro y en oscuro (cambiá el tema del celu).
- [ ] **To-do con una mano, en el celu:**
  - Agregá una tarea rápida, solo con título.
  - Tildá y destildá con un toque.
  - Abrí una tarea y ponele fecha, hora y materia.
  - Arrastrá para reordenar.
  - Recorré las vistas Hoy (tiene que incluir las vencidas), Próximas, Sin fecha, Por materia y Completadas.
- [ ] **Importar un plan real:**
  - En claude.ai pedí el plan con `/cargar-app` y copiá la respuesta **entera**, con el texto alrededor.
  - En la app: Importar → "Importar desde portapapeles".
  - En la vista previa tiene que estar ordenado por día y con colores. Las materias nuevas se pueden crear ahí o asignar a una existente.
  - Guardá.
- [ ] **Duplicados.** Importá el mismo plan otra vez: los ítems tienen que aparecer como duplicados y destildados.
- [ ] **Planes:**
  - Tiene que mostrar el progreso. Tildá una tarea del plan en el To-do y mirá que suba.
  - Borrá un plan con "Mantener los exámenes" tildado.
  - Los parciales todavía no se ven porque el calendario es el Hito B, pero quedan guardados.
- [ ] **Errores.** Con Tailscale apagado en el celu, la app tiene que mostrar un error en español y nunca una pantalla en blanco.
- [ ] **Reinicio.** Corré `ssh -t tu-usuario@tu-server.tu-tailnet.ts.net sudo reboot`. Al minuto, `https://tu-server.tu-tailnet.ts.net:8443` tiene que volver a andar sola, y tus otras apps también.

---

## 5. Prueba de rollback (cuando todo lo anterior ande)

Avisale a Claude. Va a hacer un commit que rompe `/api/health` a propósito.
1. Corré `npm run deploy`: tiene que terminar en `✖ Deploy FALLÓ`.
2. La app en `:8443` tiene que seguir andando con la versión anterior y con los datos intactos.
3. Claude revierte el commit y volvés a correr `npm run deploy` → `✔ Deploy OK`.

---

## Si algo sale mal

| Qué ves | Qué hacer |
|---|---|
| `ssh` pide contraseña | Repetí el paso 1.2. |
| `FALTA: crear /srv/study-workflow` | Corré el `sudo mkdir` del paso 2.1. |
| `Hay cambios sin commitear` | Commiteá o descartá los cambios. `.env.deploy` no cuenta. |
| `Solo se deploya desde la rama main` | `git checkout main` |
| `BUILD FALLÓ` | No se tocó nada. Pasale la salida a Claude. |
| `HEALTH CHECK FALLÓ` | Vuelve solo a la versión anterior, si había una. Pasale la salida a Claude. |
| La URL `:8443` no abre | Revisá `sudo tailscale serve status` (paso 2.2) y que Tailscale esté prendido en el celu. |

Para ver los logs del contenedor en el server:
```
ssh tu-usuario@tu-server.tu-tailnet.ts.net 'cd ~/apps/study-workflow && docker compose -p study-workflow -f releases/$(cat .deployed)/compose.yaml logs --tail 50 app'
```
