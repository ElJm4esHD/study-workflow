# Publicar una versión en GitHub Releases

Un solo comando: **`npm run release`**. Publica la versión de `package.json` con el APK genérico y los zips de las skills, y actualiza la web pública de GitHub Pages.

## Antes

- [ ] La versión está subida en `package.json` y tiene su entrada en `core/web/novedades.ts` (`npm test` lo verifica).
- [ ] `npm test`, `npm run typecheck` y `npm run a11y` dan OK.
- [ ] Todo commiteado y pusheado: `git push github main`. Si hace falta, también `npm run deploy`.
- [ ] `gh auth status` dice que estás logueado.
- [ ] Para la web pública: `.env.google` con `GOOGLE_WEB_CLIENT_ID` (ver [google-cloud.md](google-cloud.md)). Sin eso, el sitio sale sin Drive.

## Qué hace `npm run release` (frena ante cualquier problema)

1. Revisa que el árbol esté limpio, que estés en `main`, que `main` sea igual a `github/main` y que el release `vX.Y.Z` no exista.
2. **`npm run apk:public`**: compila `dist/study-workflow-X.Y.Z.apk` **sin leer `.env.deploy`**, así no trae tu dirección (la app la pide al abrir). Lo firma con tu llave de `%USERPROFILE%\.study-workflow\`, la misma del APK personal, así que uno se puede instalar encima del otro.
3. **`npm run audit:apk -- dist/study-workflow-X.Y.Z.apk`**: descomprime el APK y busca en todos sus archivos, en UTF-8 y UTF-16:
   - cada valor de `.env.deploy` (host, partes del host, usuario y puertos);
   - tu usuario y tu carpeta de Windows, y cualquier ruta `C:\Users\...`;
   - IPs privadas y de Tailscale, dominios `*.ts.net` reales, y emails de Gmail o del ITBA.

   Si encuentra algo, muestra en qué archivo y **no publica nada**.
4. Arma `dist/skill-<nombre>.zip` por cada carpeta de `skills/`.
5. `gh release create vX.Y.Z` en `main`, con el APK, los zips y las notas de la entrada de `novedades.ts`.
6. **`npm run pages -- --publish`**: arma el sitio (`vite build --mode pages`), le corre la **misma auditoría** y lo sube a la rama `gh-pages`. Si falla, el Release ya está publicado: se repite a mano con ese comando.

## Después

- [ ] En https://github.com/ElJm4esHD/study-workflow/releases revisá que estén el APK y los dos zips.
- [ ] Desde el celu, bajá el APK del Release e instalalo encima: tiene que actualizar sin desinstalar.
- [ ] Abrí `https://<tu-usuario>.github.io/study-workflow/` con recarga forzada (Ctrl+F5): tiene que decir la versión nueva en Ajustes › Acerca de, y Conectar Google Drive tiene que andar.

Para auditar un APK sin publicarlo: `npm run apk:public` y después `npm run audit:apk -- dist/study-workflow-X.Y.Z.apk`.
