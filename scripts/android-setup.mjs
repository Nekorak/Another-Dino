// Run after `cap add android`: full-screen activity, LAN plugin + permissions,
// version number, icons and splash.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SRC = 'android/app/src/main/java/io/github/nekorak/anotherdino';
copyFileSync('native/android/MainActivity.java', `${SRC}/MainActivity.java`);
copyFileSync('native/android/LanPlugin.java', `${SRC}/LanPlugin.java`);

// LAN multiplayer needs to see Wi-Fi state and receive broadcast packets.
const manifestFile = 'android/app/src/main/AndroidManifest.xml';
let manifest = readFileSync(manifestFile, 'utf8');
const perms = ['ACCESS_WIFI_STATE', 'ACCESS_NETWORK_STATE', 'CHANGE_WIFI_MULTICAST_STATE'];
for (const p of perms) {
  const tag = `<uses-permission android:name="android.permission.${p}" />`;
  if (!manifest.includes(tag)) manifest = manifest.replace('</manifest>', `    ${tag}\n</manifest>`);
}
writeFileSync(manifestFile, manifest);

// Every build is signed with the same (debug) key so a new APK installs over the old one.
mkdirSync(join(homedir(), '.android'), { recursive: true });
copyFileSync('native/android/debug.keystore', join(homedir(), '.android', 'debug.keystore'));

// CI passes BUILD_NUMBER so each release has a higher versionCode.
const build = Number(process.env.BUILD_NUMBER || 1);
const gradleFile = 'android/app/build.gradle';
const gradle = readFileSync(gradleFile, 'utf8')
  .replace(/versionCode \d+/, `versionCode ${build}`)
  .replace(/versionName "[^"]*"/, `versionName "1.0.${build}"`);
writeFileSync(gradleFile, gradle);

execSync(
  'npx capacitor-assets generate --android --iconBackgroundColor "#9fdcff" --iconBackgroundColorDark "#9fdcff" --splashBackgroundColor "#9fdcff" --splashBackgroundColorDark "#9fdcff"',
  { stdio: 'inherit' },
);
