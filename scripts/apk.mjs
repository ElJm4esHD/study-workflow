// APK firmado de un comando. Uso: node scripts/apk.mjs [--check] [--public]. Guía: docs/android.md.
// --public: APK genérico para GitHub Releases, sin la dirección de .env.deploy (pide la del usuario al abrir).
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const win = process.platform === 'win32';
const exe = (name) => (win ? `${name}.exe` : name);
const fwd = (p) => p.replaceAll('\\', '/'); // en .properties la "\" es escape
const GUIA = 'Mirá docs/android.md.';

const jdkCandidates = [process.env.JAVA_HOME, 'C:\\Program Files\\Android\\Android Studio\\jbr'];
const sdkCandidates = [process.env.ANDROID_HOME, process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk')];
const jdk = jdkCandidates.find((d) => d && existsSync(join(d, 'bin', exe('keytool'))));
const sdk = sdkCandidates.find((d) => d && existsSync(join(d, 'platforms')) && readdirSync(join(d, 'platforms')).length > 0);
const keyDir = join(homedir(), '.study-workflow');
const keystore = join(keyDir, 'release.jks');
const keyProps = join(keyDir, 'keystore.properties');

console.log(jdk ? `✔ JDK: ${jdk}` : '✖ No encontré el JDK. Instalá Android Studio (trae el JDK) o definí JAVA_HOME.');
console.log(sdk ? `✔ Android SDK: ${sdk}` : '✖ No encontré el Android SDK. Abrí Android Studio y terminá el asistente "Standard", o definí ANDROID_HOME.');
console.log(existsSync(keystore) && existsSync(keyProps)
  ? `✔ Keystore: ${keystore}`
  : `• Keystore: todavía no existe; se crea solo en ${keystore} con el primer npm run apk.`);
if (!jdk || !sdk) { console.error(`Falta algo para compilar. ${GUIA}`); process.exit(1); }
if (process.argv.includes('--check')) { console.log('Todo listo para npm run apk.'); process.exit(0); }

const pub = process.argv.includes('--public');
const env = { ...process.env, JAVA_HOME: jdk, ANDROID_HOME: sdk, SW_PUBLIC: pub ? '1' : '' };
const sh = (cmd, cwd = root) => {
  const r = spawnSync(cmd, { cwd, env, shell: true, stdio: 'inherit' });
  if (r.status !== 0) { console.error(`✖ Falló: ${cmd}. ${GUIA}`); process.exit(1); }
};

writeFileSync(join(root, 'android', 'local.properties'), `sdk.dir=${fwd(sdk)}\n`);

if (!existsSync(keystore) || !existsSync(keyProps)) {
  if (existsSync(keystore)) { console.error(`✖ Existe ${keystore} pero falta ${keyProps}: no lo piso. ${GUIA}`); process.exit(1); }
  mkdirSync(keyDir, { recursive: true });
  const pass = randomBytes(18).toString('base64url');
  // PKCS12 (el default) usa la misma clave para el almacén y para la llave.
  execFileSync(join(jdk, 'bin', exe('keytool')), ['-genkeypair', '-keystore', keystore, '-alias', 'study-workflow',
    '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-storepass', pass, '-keypass', pass,
    '-dname', 'CN=Study Workflow'], { stdio: 'inherit' });
  writeFileSync(keyProps, `storeFile=${fwd(keystore)}\nstorePassword=${pass}\nkeyAlias=study-workflow\nkeyPassword=${pass}\n`);
  console.log(`\n⚠ Creé la llave de firma en ${keyDir}.\n  Hacele backup a esa carpeta (pendrive, nube personal): sin ella no vas a poder actualizar\n  la app encima, y vas a tener que desinstalarla e instalarla de nuevo.\n`);
}

// versionName = la de package.json; versionCode = X·1000000 + Y·1000 + Z (sube con cada versión y queda arriba del esquema viejo por fecha).
const versionName = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const [vx, vy, vz, vb] = versionName.split(/[.-]/).filter((s) => s !== 'beta').map(Number);
// 2.0.0-beta.N queda justo debajo de 2.0.0 (y encima de 1.x).
const versionCode = vx * 1_000_000 + vy * 1000 + vz - (vb === undefined ? 0 : 100 - vb);

sh('npx vite build');
sh('npx cap sync android');
sh(`${win ? '.\\gradlew.bat' : './gradlew'} assembleRelease -PswVersionCode=${versionCode} -PswVersionName=${versionName}`, join(root, 'android'));

const out = join(root, 'dist', pub ? `study-workflow-${versionName}.apk` : 'study-workflow.apk');
copyFileSync(join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'), out);
console.log(`\n✔ APK ${pub ? 'público (sin server precargado) ' : ''}listo (versión ${versionName}): ${out}`);
