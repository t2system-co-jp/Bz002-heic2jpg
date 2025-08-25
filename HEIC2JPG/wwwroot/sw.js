const CACHE_NAME = 'heic2jpg-v1';
const urlsToCache = [
  '/',
  '/css/app.css',
  '/css/converter.css',
  '/favicon.png',
  '/icon-192.png',
  '/manifest.json',
  '/js/commonUtils.js',
  '/js/heicConverter.js',
  '/js/ffmpegConverter.js',
  '/lib/jszip/jszip.min.js',
  '/lib/libheif/libheif.js',
  '/lib/ffmpeg/ffmpeg.min.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('キャッシュを開いています');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  // chrome-extension などのスキームをフィルタリング
  const protocol = new URL(event.request.url).protocol;
  if (protocol !== 'http:' && protocol !== 'https:') {
    return fetch(event.request);
  }
  
  // GET リクエスト以外は処理しない
  if (event.request.method !== 'GET') {
    return fetch(event.request);
  }

  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        
        return fetch(event.request).then(
          function(response) {
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                try {
                  cache.put(event.request, responseToCache);
                } catch (e) {
                  console.warn('キャッシュ保存失敗:', e);
                }
              });

            return response;
          }
        );
      })
    );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('古いキャッシュを削除しています:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});