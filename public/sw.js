const CACHE_VERSION = 'v3';
const SHELL_CACHE = `studybridge-shell-${CACHE_VERSION}`;
const ASSETS_CACHE = `studybridge-assets-${CACHE_VERSION}`;

const APP_ROUTES = [
  '/',
  '/about',
  '/privacy',
  '/terms',
  '/study',
  '/materials',
  '/library',
  '/settings',
  '/login'
];

const STATIC_ASSETS = [
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/data/restricted-districts.json'
];

function extractAssetUrlsFromHtml(htmlText) {
  const urls = new Set();
  const attrRegex = /<(?:script|link)\b[^>]+?(?:src|href)=["']([^"']+)["']/gi;
  let match;
  while ((match = attrRegex.exec(htmlText)) !== null) {
    const rawUrl = match[1];
    if (!rawUrl) continue;
    try {
      const parsed = new URL(rawUrl, self.location.origin);
      if (parsed.origin !== self.location.origin) continue;
      if (
        parsed.pathname.startsWith('/assets/') ||
        /\.(?:js|mjs|css|woff2?|ttf|png|jpg|jpeg|svg|ico|json)$/i.test(parsed.pathname)
      ) {
        urls.add(parsed.pathname + parsed.search);
      }
    } catch {
      // Ignore malformed URLs
    }
  }
  return Array.from(urls);
}

async function cacheAppShellAndAssets(shellResponse, routePath) {
  const shellCache = await caches.open(SHELL_CACHE);
  const previousShell = await shellCache.match('/');
  const previousHtml = previousShell ? await previousShell.clone().text().catch(() => '') : '';

  const freshHtml = await shellResponse.clone().text().catch(() => '');

  // Cache the shell response for the navigated route and canonical '/'
  await shellCache.put(routePath || '/', shellResponse.clone());
  await shellCache.put('/', shellResponse.clone());

  const htmlAssets = freshHtml ? extractAssetUrlsFromHtml(freshHtml) : [];
  const desiredAssets = Array.from(new Set([...STATIC_ASSETS, ...htmlAssets]));

  const assetsCache = await caches.open(ASSETS_CACHE);

  // If HTML changed (new deploy), purge stale hashed bundles no longer referenced
  if (previousHtml && freshHtml && previousHtml !== freshHtml) {
    const previousAssetSet = new Set(extractAssetUrlsFromHtml(previousHtml));
    const desiredAssetSet = new Set(desiredAssets);
    const cachedKeys = await assetsCache.keys();
    await Promise.all(
      cachedKeys.map((req) => {
        const reqUrl = new URL(req.url);
        const keyPath = reqUrl.pathname + reqUrl.search;
        const isStaticKeep = STATIC_ASSETS.includes(keyPath);
        const wasOldBundle = previousAssetSet.has(keyPath) || reqUrl.pathname.startsWith('/assets/');
        if (!isStaticKeep && wasOldBundle && !desiredAssetSet.has(keyPath)) {
          return assetsCache.delete(req);
        }
        return Promise.resolve(false);
      })
    );
  }

  // Ensure all referenced static/built assets are cached
  await Promise.allSettled(
    desiredAssets.map(async (assetUrl) => {
      const existing = await assetsCache.match(assetUrl);
      if (!existing || STATIC_ASSETS.includes(assetUrl)) {
        const res = await fetch(assetUrl, { cache: 'no-cache', credentials: 'same-origin' });
        if (res && res.ok) {
          await assetsCache.put(assetUrl, res);
        }
      }
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const shellCache = await caches.open(SHELL_CACHE);
        const shellResponse = await fetch('/', { cache: 'no-cache', credentials: 'same-origin' });

        if (shellResponse && shellResponse.ok) {
          // Precache all app routes using the fresh app shell HTML
          await Promise.all(
            APP_ROUTES.map((route) => shellCache.put(route, shellResponse.clone()))
          );
          await cacheAppShellAndAssets(shellResponse.clone(), '/');
        } else {
          // Fallback: precache static assets directly
          const assetsCache = await caches.open(ASSETS_CACHE);
          await Promise.allSettled(
            STATIC_ASSETS.map((asset) => assetsCache.add(asset))
          );
        }
      } catch (err) {
        console.warn('Service worker precache partial fail:', err);
      }
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== SHELL_CACHE && key !== ASSETS_CACHE) {
            return caches.delete(key);
          }
          return Promise.resolve(false);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Only intercept same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never intercept Vite development assets, WebSockets, SW script itself, or API proxy calls
  if (
    url.pathname === '/sw.js' ||
    url.pathname.startsWith('/@') ||
    url.pathname.includes('node_modules') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/api/') ||
    url.search.includes('v=') ||
    url.search.includes('import') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return;
  }

  // Navigation requests (SPA routes): Network-first with cache fallback for offline loading
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request.url, {
            cache: 'no-cache',
            credentials: 'same-origin'
          });
          if (networkResponse && networkResponse.ok) {
            const contentType = networkResponse.headers.get('content-type') || '';
            if (contentType.includes('text/html')) {
              event.waitUntil(
                cacheAppShellAndAssets(networkResponse.clone(), url.pathname).catch(() => {})
              );
            }
          }
          return networkResponse;
        } catch {
          const shellCache = await caches.open(SHELL_CACHE);
          const routeMatch = await shellCache.match(url.pathname);
          if (routeMatch) return routeMatch;
          const rootMatch = await shellCache.match('/');
          if (rootMatch) return rootMatch;
          const anyMatch = await caches.match(event.request);
          if (anyMatch) return anyMatch;
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // Unhashed JSON / manifest assets: stale-while-revalidate
  if (
    url.pathname === '/manifest.json' ||
    url.pathname.includes('restricted-districts.json')
  ) {
    event.respondWith(
      (async () => {
        const assetsCache = await caches.open(ASSETS_CACHE);
        const cached = await assetsCache.match(event.request);
        const networkPromise = fetch(event.request)
          .then((res) => {
            if (res && res.ok) {
              assetsCache.put(event.request, res.clone());
            }
            return res;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(networkPromise);
          return cached;
        }
        const netRes = await networkPromise;
        return netRes || new Response('', { status: 503, statusText: 'Offline' });
      })()
    );
    return;
  }

  // Static & Vite-built assets (/assets/*, scripts, stylesheets, fonts, images)
  if (
    url.pathname.startsWith('/assets/') ||
    /\.(?:js|mjs|css|woff2?|ttf|png|jpg|jpeg|svg|ico|webp)$/i.test(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const assetsCache = await caches.open(ASSETS_CACHE);
        const cached = await assetsCache.match(event.request);
        if (cached) return cached;

        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.ok) {
          await assetsCache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      })()
    );
  }
});
