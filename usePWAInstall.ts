import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PWAReadinessReport {
  serviceWorkerSupported: boolean;
  serviceWorkerActive: boolean;
  serviceWorkerScope: string | null;
  cacheStorageSupported: boolean;
  cacheNames: string[];
  cachedEntryCount: number;
  manifestDetected: boolean;
  manifestHref: string | null;
  isStandalone: boolean;
  checkedAt: string;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    setIsAndroid(/android/.test(ua));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const displayMediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    displayMediaQuery.addEventListener('change', handleDisplayChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      displayMediaQuery.removeEventListener('change', handleDisplayChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export async function inspectPWAReadiness(): Promise<PWAReadinessReport> {
  const serviceWorkerSupported = 'serviceWorker' in navigator;
  let serviceWorkerActive = false;
  let serviceWorkerScope: string | null = null;

  if (serviceWorkerSupported) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        const activeReg = registrations.find(r => r.active) || registrations[0];
        serviceWorkerActive = Boolean(activeReg.active || activeReg.installing || activeReg.waiting);
        serviceWorkerScope = activeReg.scope;
      }
    } catch {
      serviceWorkerActive = false;
    }
  }

  const cacheStorageSupported = 'caches' in window;
  let cacheNames: string[] = [];
  let cachedEntryCount = 0;

  if (cacheStorageSupported) {
    try {
      cacheNames = await window.caches.keys();
      for (const name of cacheNames) {
        const cache = await window.caches.open(name);
        const keys = await cache.keys();
        cachedEntryCount += keys.length;
      }
    } catch {
      cacheNames = [];
    }
  }

  const manifestEl = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  return {
    serviceWorkerSupported,
    serviceWorkerActive,
    serviceWorkerScope,
    cacheStorageSupported,
    cacheNames,
    cachedEntryCount,
    manifestDetected: Boolean(manifestEl),
    manifestHref: manifestEl?.getAttribute('href') || null,
    isStandalone,
    checkedAt: new Date().toLocaleTimeString(),
  };
}

export async function warmOfflineCache(): Promise<{ cachedAssets: number; cacheName: string }> {
  const cacheName = 'sentinel-offline-core-v1';
  const urlsToCache = [
    '/',
    '/icon.svg',
    '/pwa-192x192.png',
    '/pwa-512x512.png',
    '/pwa-maskable-512x512.png',
    '/apple-touch-icon.png',
    '/manifest.webmanifest',
  ];

  if (!('caches' in window)) {
    return { cachedAssets: 0, cacheName };
  }

  const cache = await window.caches.open(cacheName);
  let cachedCount = 0;

  await Promise.all(
    urlsToCache.map(async url => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res.ok) {
          await cache.put(url, res);
          cachedCount += 1;
        }
      } catch {
        // Skip unreachable optional endpoints in dev
      }
    })
  );

  return { cachedAssets: cachedCount, cacheName };
}
