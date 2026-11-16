export type PackageTargetFormat =
  | 'apk_package'
  | 'twa_bundle'
  | 'capacitor_bundle'
  | 'icon_pack';

export interface MobilePackageConfig {
  appName: string;
  shortName: string;
  packageId: string;
  versionName: string;
  versionCode: number;
  displayMode: 'standalone' | 'fullscreen';
  targetUrl: string;
  themeColor: string;
  backgroundColor: string;
  offlineCachingEnabled: boolean;
}

export interface GeneratedPackageArtifact {
  id: string;
  format: PackageTargetFormat;
  filename: string;
  sizeBytes: number;
  sha256: string;
  fileCount: number;
  generatedAt: string;
  blob: Blob;
}

interface ZipEntryInput {
  path: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildZipArchive(entries: ZipEntryInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const now = new Date();
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    ((now.getSeconds() >> 1) & 0x1f);
  const dosDate =
    (((Math.max(1980, now.getFullYear()) - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f);

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const data = entry.data;
    const crc = crc32(data);

    // Local file header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // store (method 0)
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

    // Central directory header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  let centralSize = 0;
  for (const part of centralParts) {
    centralSize += part.length;
  }

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalSize = offset + centralSize + eocd.length;
  const output = new Uint8Array(totalSize);
  let cursor = 0;

  for (const p of localParts) {
    output.set(p, cursor);
    cursor += p.length;
  }
  for (const p of centralParts) {
    output.set(p, cursor);
    cursor += p.length;
  }
  output.set(eocd, cursor);

  return output;
}

async function fetchBinaryAsset(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Unable to fetch asset ${url}`);
  }
  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}

async function computeSha256(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  const hashBytes = new Uint8Array(digest);
  return Array.from(hashBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildWebManifestJson(config: MobilePackageConfig): string {
  return JSON.stringify(
    {
      id: '/',
      name: config.appName,
      short_name: config.shortName,
      description: `${config.appName} standalone security console with offline caching.`,
      start_url: '/',
      scope: '/',
      display: config.displayMode,
      theme_color: config.themeColor,
      background_color: config.backgroundColor,
      icons: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        {
          src: '/pwa-maskable-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    null,
    2
  );
}

function buildAndroidManifestXml(config: MobilePackageConfig): string {
  const host = (() => {
    try {
      return new URL(config.targetUrl).host;
    } catch {
      return 'localhost';
    }
  })();

  return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${escapeXml(config.packageId)}"
    android:versionCode="${config.versionCode}"
    android:versionName="${escapeXml(config.versionName)}">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="false"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher"
        android:label="${escapeXml(config.appName)}"
        android:theme="@style/Theme.AppCompat.NoActionBar">

        <meta-data
            android:name="asset_statements"
            android:resource="@string/asset_statements" />

        <activity
            android:name="com.google.androidbrowserhelper.trusted.LauncherActivity"
            android:exported="true"
            android:label="${escapeXml(config.shortName)}">

            <meta-data
                android:name="android.support.customtabs.trusted.DEFAULT_URL"
                android:value="${escapeXml(config.targetUrl)}" />

            <meta-data
                android:name="android.support.customtabs.trusted.STATUS_BAR_COLOR"
                android:resource="@color/colorPrimary" />

            <meta-data
                android:name="android.support.customtabs.trusted.DISPLAY_MODE"
                android:value="${config.displayMode === 'fullscreen' ? 'immersive' : 'standalone'}" />

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data
                    android:scheme="https"
                    android:host="${escapeXml(host)}" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`;
}

function buildTwaManifestJson(config: MobilePackageConfig): string {
  const host = (() => {
    try {
      return new URL(config.targetUrl).host;
    } catch {
      return 'localhost';
    }
  })();

  return JSON.stringify(
    {
      packageId: config.packageId,
      host,
      name: config.appName,
      launcherName: config.shortName,
      display: config.displayMode,
      themeColor: config.themeColor,
      navigationColor: config.backgroundColor,
      backgroundColor: config.backgroundColor,
      enableNotifications: false,
      startUrl: '/',
      iconUrl: `${config.targetUrl.replace(/\/$/, '')}/pwa-512x512.png`,
      maskableIconUrl: `${config.targetUrl.replace(/\/$/, '')}/pwa-maskable-512x512.png`,
      splashScreenFadeOutDuration: 300,
      appVersionName: config.versionName,
      appVersionCode: config.versionCode,
      fallbackType: 'customtabs',
      enableSiteSettingsShortcut: 'true',
      isChromeOSOnly: false,
      orientation: 'default',
    },
    null,
    2
  );
}

function buildCapacitorConfigJson(config: MobilePackageConfig): string {
  return JSON.stringify(
    {
      appId: config.packageId,
      appName: config.appName,
      webDir: 'dist',
      server: {
        url: config.targetUrl,
        cleartext: false,
        androidScheme: 'https',
      },
      android: {
        backgroundColor: config.backgroundColor,
        allowMixedContent: false,
        captureInput: true,
        webContentsDebuggingEnabled: false,
      },
      plugins: {
        SplashScreen: {
          launchShowDuration: 1200,
          backgroundColor: config.backgroundColor,
          showSpinner: false,
        },
      },
    },
    null,
    2
  );
}

function buildGradleSnippet(config: MobilePackageConfig): string {
  return `plugins {
    id 'com.android.application'
}

android {
    namespace '${config.packageId}'
    compileSdk 34

    defaultConfig {
        applicationId '${config.packageId}'
        minSdk 24
        targetSdk 34
        versionCode ${config.versionCode}
        versionName '${config.versionName}'
    }

    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
        }
    }
}

dependencies {
    implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.5.0'
}
`;
}

export async function generateMobilePackage(
  format: PackageTargetFormat,
  config: MobilePackageConfig,
  onProgress?: (stage: string) => void
): Promise<GeneratedPackageArtifact> {
  const encoder = new TextEncoder();
  const slug = config.shortName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'sentinel';

  onProgress?.('Fetching launcher & maskable icon assets...');
  const [icon192, icon512, iconMaskable, iconApple, iconSvg] = await Promise.all([
    fetchBinaryAsset('/pwa-192x192.png'),
    fetchBinaryAsset('/pwa-512x512.png'),
    fetchBinaryAsset('/pwa-maskable-512x512.png'),
    fetchBinaryAsset('/apple-touch-icon.png'),
    fetchBinaryAsset('/icon.svg'),
  ]);

  onProgress?.('Generating Android manifests & offline shell...');
  const entries: ZipEntryInput[] = [];
  const manifestJson = buildWebManifestJson(config);
  const androidManifest = buildAndroidManifestXml(config);
  const twaManifest = buildTwaManifestJson(config);
  const capConfig = buildCapacitorConfigJson(config);
  const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">${config.themeColor}</color>
    <color name="backgroundColor">${config.backgroundColor}</color>
</resources>
`;
  const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${escapeXml(config.appName)}</string>
    <string name="launcher_name">${escapeXml(config.shortName)}</string>
    <string name="asset_statements">[{"relation":["delegate_permission/common.handle_all_urls"],"target":{"namespace":"web","site":"${escapeXml(config.targetUrl)}"}}]</string>
</resources>
`;

  if (format === 'apk_package') {
    entries.push(
      { path: 'AndroidManifest.xml', data: encoder.encode(androidManifest) },
      {
        path: 'META-INF/MANIFEST.MF',
        data: encoder.encode(
          `Manifest-Version: 1.0\nCreated-By: Sentinel Mobile Export Center\nPackage-Id: ${config.packageId}\nVersion-Name: ${config.versionName}\nVersion-Code: ${config.versionCode}\nDisplay-Mode: ${config.displayMode}\n`
        ),
      },
      { path: 'res/mipmap-hdpi/ic_launcher.png', data: icon192 },
      { path: 'res/mipmap-xxxhdpi/ic_launcher.png', data: icon512 },
      { path: 'res/mipmap-xxxhdpi/ic_launcher_maskable.png', data: iconMaskable },
      { path: 'res/values/colors.xml', data: encoder.encode(colorsXml) },
      { path: 'res/values/strings.xml', data: encoder.encode(stringsXml) },
      { path: 'assets/www/manifest.webmanifest', data: encoder.encode(manifestJson) },
      { path: 'assets/twa-manifest.json', data: encoder.encode(twaManifest) },
      {
        path: 'SIDELOAD_BUILD_NOTES.txt',
        data: encoder.encode(
          `${config.appName} (${config.packageId} v${config.versionName}) Android Wrapper Archive\n` +
            `Target Origin: ${config.targetUrl}\n` +
            `Display Mode: ${config.displayMode}\n` +
            `Offline Caching: ${config.offlineCachingEnabled ? 'Enabled (Workbox Service Worker)' : 'Disabled'}\n\n` +
            `To produce a Play-Store or ADB-signed binary on your workstation:\n` +
            `1. Install Bubblewrap CLI: npm i -g @bubblewrap/cli\n` +
            `2. Run: bubblewrap init --manifest=${config.targetUrl.replace(/\/$/, '')}/manifest.webmanifest\n` +
            `3. Run: bubblewrap build (generates signed app-release-signed.apk)\n` +
            `4. Sideload via ADB: adb install app-release-signed.apk\n`
        ),
      }
    );
  } else if (format === 'twa_bundle') {
    entries.push(
      { path: 'twa-manifest.json', data: encoder.encode(twaManifest) },
      { path: 'app/build.gradle', data: encoder.encode(buildGradleSnippet(config)) },
      { path: 'app/src/main/AndroidManifest.xml', data: encoder.encode(androidManifest) },
      { path: 'app/src/main/res/values/colors.xml', data: encoder.encode(colorsXml) },
      { path: 'app/src/main/res/values/strings.xml', data: encoder.encode(stringsXml) },
      { path: 'app/src/main/res/mipmap-hdpi/ic_launcher.png', data: icon192 },
      { path: 'app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', data: icon512 },
      { path: 'app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png', data: iconMaskable },
      { path: 'manifest.webmanifest', data: encoder.encode(manifestJson) },
      {
        path: 'BUILD_APK.md',
        data: encoder.encode(
          `# ${config.appName} — Android TWA Build Guide\n\n` +
            `Package ID: \`${config.packageId}\`\n` +
            `Version: \`${config.versionName}\` (${config.versionCode})\n\n` +
            `## Quick Build with Bubblewrap\n` +
            `\`\`\`bash\nnpm install -g @bubblewrap/cli\nbubblewrap update\nbubblewrap build\nadb install app-release-signed.apk\n\`\`\`\n`
        ),
      }
    );
  } else if (format === 'capacitor_bundle') {
    entries.push(
      { path: 'capacitor.config.json', data: encoder.encode(capConfig) },
      { path: 'android/app/src/main/AndroidManifest.xml', data: encoder.encode(androidManifest) },
      { path: 'android/app/src/main/res/values/colors.xml', data: encoder.encode(colorsXml) },
      { path: 'android/app/src/main/res/values/strings.xml', data: encoder.encode(stringsXml) },
      { path: 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png', data: icon192 },
      { path: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', data: icon512 },
      { path: 'www/manifest.webmanifest', data: encoder.encode(manifestJson) },
      {
        path: 'BUILD_APK.md',
        data: encoder.encode(
          `# ${config.appName} — Capacitor Android Build Guide\n\n` +
            `1. Copy \`capacitor.config.json\` into your project root.\n` +
            `2. Run \`npm install @capacitor/core @capacitor/cli @capacitor/android\`.\n` +
            `3. Run \`npm run build && npx cap sync android\`.\n` +
            `4. Build APK via \`cd android && ./gradlew assembleRelease\`.\n`
        ),
      }
    );
  } else {
    entries.push(
      { path: 'icon.svg', data: iconSvg },
      { path: 'pwa-192x192.png', data: icon192 },
      { path: 'pwa-512x512.png', data: icon512 },
      { path: 'pwa-maskable-512x512.png', data: iconMaskable },
      { path: 'apple-touch-icon.png', data: iconApple },
      { path: 'manifest.webmanifest', data: encoder.encode(manifestJson) }
    );
  }

  onProgress?.('Packing archive & computing SHA-256 checksum...');
  const archiveBytes = buildZipArchive(entries);
  const sha256 = await computeSha256(archiveBytes);

  const mimeType =
    format === 'apk_package'
      ? 'application/vnd.android.package-archive'
      : 'application/zip';

  const filename =
    format === 'apk_package'
      ? `${slug}-v${config.versionName}-android-wrapper.apk`
      : format === 'twa_bundle'
      ? `${slug}-v${config.versionName}-twa-android.zip`
      : format === 'capacitor_bundle'
      ? `${slug}-v${config.versionName}-capacitor-android.zip`
      : `${slug}-android-icons.zip`;

  const arrayCopy = new Uint8Array(archiveBytes.byteLength);
  arrayCopy.set(archiveBytes);
  const blob = new Blob([arrayCopy.buffer], { type: mimeType });

  return {
    id: `pkg-${Date.now()}`,
    format,
    filename,
    sizeBytes: archiveBytes.byteLength,
    sha256,
    fileCount: entries.length,
    generatedAt: new Date().toLocaleTimeString(),
    blob,
  };
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
