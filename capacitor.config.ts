import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android app is a thin SHELL around the website: it opens SITE_URL, so every change to the website reaches the app at once
 * and there is only one project folder to maintain (site + server + app). Give the address (and the app id) when you run the
 * Capacitor commands, for example:
 *   SITE_URL=https://mr-judge.vercel.app APP_ID=com.yourname.mrjudge npx cap sync android
 * If the website moves to another address later, run the same command with the new SITE_URL and rebuild the app.
 */
const SITE_URL = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
if (!/^https:\/\/[^/\s]+/.test(SITE_URL)) {
  throw new Error('Set SITE_URL to the https address of your website, for example SITE_URL=https://mr-judge.vercel.app');
}

const config: CapacitorConfig = {
  appId: process.env.APP_ID || 'com.yourname.mrjudge',
  appName: process.env.APP_NAME || 'آقای قاضی',
  webDir: 'android-www', // only holds the "no internet" page; the app itself is loaded from SITE_URL
  server: {
    url: `${SITE_URL}/`,
    cleartext: false,
    allowNavigation: [new URL(SITE_URL).host],
    errorPath: 'offline.html',
  },
};

export default config;
