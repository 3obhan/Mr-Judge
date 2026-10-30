/**
 * One-time setup of the Android project for the Cafe Bazaar build.
 * Run AFTER:  npm run build:bazaar && npx cap add android
 *   node scripts/setup-bazaar-android.mjs
 * It is safe to run again. Anything it cannot patch is printed as a "MANUAL" step.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
const appId = cfg.appId;
const KOTLIN = '2.1.20';
const POOLAKEY = 'com.github.cafebazaar.Poolakey:poolakey:2.2.0';
const manual = [];
const ok = (m) => console.log('OK     ' + m);

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);
const androidDir = path.join(root, 'android');
if (!fs.existsSync(androidDir)) { console.error('android/ not found. Run: npx cap add android'); process.exit(1); }
if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(appId)) { console.error(`Bad appId "${appId}" in capacitor.config.json`); process.exit(1); }

// 1) Plugin source + MainActivity
const javaDir = path.join(androidDir, 'app/src/main/java', ...appId.split('.'));
fs.mkdirSync(javaDir, { recursive: true });
write(path.join(javaDir, 'PoolakeyPlugin.kt'), read(path.join(root, 'native/android/PoolakeyPlugin.kt')).replace('__APP_ID__', appId));
ok('PoolakeyPlugin.kt copied');

const mainJava = path.join(javaDir, 'MainActivity.java');
const mainKt = path.join(javaDir, 'MainActivity.kt');
if (fs.existsSync(mainKt)) {
  write(mainKt, `package ${appId}

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(PoolakeyPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
`);
  ok('MainActivity.kt registers the plugin');
} else {
  write(mainJava, `package ${appId};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PoolakeyPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);
  ok('MainActivity.java registers the plugin');
}

// 2) Gradle: jitpack repo, Kotlin plugin, Poolakey dependency
const rootGradle = path.join(androidDir, 'build.gradle');
if (fs.existsSync(rootGradle)) {
  let s = read(rootGradle);
  if (!s.includes('jitpack.io')) {
    const n = s.replace(/allprojects\s*\{\s*repositories\s*\{/, (m) => `${m}\n        maven { url 'https://jitpack.io' }`);
    if (n !== s) { s = n; ok('jitpack added (build.gradle)'); } else manual.push("Add maven { url 'https://jitpack.io' } to the repositories used by all modules (android/build.gradle or settings.gradle).");
  }
  if (!s.includes('kotlin-gradle-plugin')) {
    const n = s.replace(/(classpath\s+['"]com\.android\.tools\.build:gradle:[^'"]+['"])/, `$1\n        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:${KOTLIN}'`);
    if (n !== s) { s = n; ok('Kotlin Gradle plugin added'); } else manual.push(`Add  classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:${KOTLIN}'  to buildscript dependencies in android/build.gradle.`);
  }
  write(rootGradle, s);
}
const settingsGradle = path.join(androidDir, 'settings.gradle');
if (fs.existsSync(settingsGradle) && read(settingsGradle).includes('dependencyResolutionManagement') && !read(settingsGradle).includes('jitpack.io')) {
  manual.push("android/settings.gradle uses dependencyResolutionManagement: add maven { url 'https://jitpack.io' } inside its repositories { } block.");
}

const appGradle = path.join(androidDir, 'app/build.gradle');
let a = read(appGradle);
if (!/kotlin-android|org\.jetbrains\.kotlin\.android/.test(a)) {
  a = a.replace(/(apply plugin: ['"]com\.android\.application['"])/, "$1\napply plugin: 'kotlin-android'");
  if (!/kotlin-android/.test(a)) manual.push("Add  apply plugin: 'kotlin-android'  to android/app/build.gradle.");
  else ok("kotlin-android applied (app/build.gradle)");
}
if (!a.includes('Poolakey')) {
  const n = a.replace(/dependencies\s*\{/, (m) => `${m}\n    implementation "${POOLAKEY}"`);
  if (n !== a) { a = n; ok('Poolakey dependency added'); } else manual.push(`Add  implementation "${POOLAKEY}"  to dependencies in android/app/build.gradle.`);
}
write(appGradle, a);

// 3) Manifest: Bazaar billing permission, visibility of the Bazaar app, microphone
const manifestPath = path.join(androidDir, 'app/src/main/AndroidManifest.xml');
let m = read(manifestPath);
const add = (needle, line) => { if (!m.includes(needle)) { m = m.replace('</manifest>', `    ${line}\n</manifest>`); ok(needle); } };
add('com.farsitel.bazaar.permission.PAY_THROUGH_BAZAAR', '<uses-permission android:name="com.farsitel.bazaar.permission.PAY_THROUGH_BAZAAR" />');
add('android.permission.RECORD_AUDIO', '<uses-permission android:name="android.permission.RECORD_AUDIO" />');
add('android.permission.INTERNET', '<uses-permission android:name="android.permission.INTERNET" />');
if (!m.includes('<queries>')) { m = m.replace('</manifest>', '    <queries>\n        <package android:name="com.farsitel.bazaar" />\n    </queries>\n</manifest>'); ok('queries for Bazaar app'); }
write(manifestPath, m);

console.log(manual.length ? '\nMANUAL steps needed:\n- ' + manual.join('\n- ') : '\nAll patches applied.');
console.log('\nNext: npx cap sync android && npx cap open android');
