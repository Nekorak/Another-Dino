// Run after `cap add android`: full-screen activity, LAN plugin + permissions,
// version number, icons and splash.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SRC = 'android/app/src/main/java/io/github/nekorak/anotherdino';
copyFileSync('native/android/MainActivity.java', `${SRC}/MainActivity.java`);
copyFileSync('native/android/LanPlugin.java', `${SRC}/LanPlugin.java`);
copyFileSync('native/android/UpdaterPlugin.java', `${SRC}/UpdaterPlugin.java`);
copyFileSync('native/android/SharePlugin.java', `${SRC}/SharePlugin.java`);
copyFileSync('native/android/WidgetPlugin.java', `${SRC}/WidgetPlugin.java`);
copyFileSync('native/android/DinoWidget.java', `${SRC}/DinoWidget.java`);
// home-screen widget: layout, look and size
const RES = 'android/app/src/main/res';
for (const f of ['layout/widget_dino.xml', 'drawable/widget_bg.xml', 'xml/dino_widget_info.xml']) {
  mkdirSync(join(RES, f.split('/')[0]), { recursive: true });
  copyFileSync(`native/android/res/${f}`, join(RES, f));
}

// LAN multiplayer needs to see Wi-Fi state and receive broadcast packets;
// the in-game update button needs to hand the new APK to the installer.
const manifestFile = 'android/app/src/main/AndroidManifest.xml';
let manifest = readFileSync(manifestFile, 'utf8');
// the camera is only used to scan QR codes; without VIBRATE the WebView ignores navigator.vibrate()
const perms = ['ACCESS_WIFI_STATE', 'ACCESS_NETWORK_STATE', 'CHANGE_WIFI_MULTICAST_STATE', 'REQUEST_INSTALL_PACKAGES', 'CAMERA', 'VIBRATE'];
for (const p of perms) {
  const tag = `<uses-permission android:name="android.permission.${p}" />`;
  if (!manifest.includes(tag)) manifest = manifest.replace('</manifest>', `    ${tag}\n</manifest>`);
}
// the camera is optional: phones and tablets without one still install the game
const feature = '<uses-feature android:name="android.hardware.camera" android:required="false" />';
if (!manifest.includes(feature)) manifest = manifest.replace('</manifest>', `    ${feature}\n</manifest>`);
// the widget is a broadcast receiver inside <application>
const receiver = `<receiver android:name=".DinoWidget" android:exported="false">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/dino_widget_info" />
        </receiver>`;
if (!manifest.includes('.DinoWidget')) manifest = manifest.replace('</application>', `    ${receiver}\n    </application>`);
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
