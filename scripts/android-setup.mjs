// Run after `cap add android`: full-screen activity, version number, icons and splash.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

copyFileSync(
  'native/android/MainActivity.java',
  'android/app/src/main/java/io/github/nekorak/anotherdino/MainActivity.java',
);

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
