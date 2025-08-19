// sw.js - Service Worker
const CACHE_NAME = 'seminar-v1';
const API_CACHE_NAME = 'api-cache-v1';

// 캐시할 정적 파일들
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/css/index.css',
  '/assets/js/index.js',
  '/assets/images/istudy-logo.png',
];

// Service Worker 설치
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(urlsToCache);
    })
  );
});

// Service Worker 활성화
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 네트워크 요청 가로채기
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API 요청 처리
  if (url.href.includes('script.google.com')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then((cache) => {
        return fetch(request)
          .then((response) => {
            // 성공하면 캐시에 저장
            if (response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => {
            // 실패하면 캐시에서 가져오기
            return cache.match(request);
          });
      })
    );
  }
  // 정적 파일 처리
  else {
    event.respondWith(
      caches.match(request).then((response) => {
        return (
          response ||
          fetch(request).then((fetchResponse) => {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, fetchResponse.clone());
              return fetchResponse;
            });
          })
        );
      })
    );
  }
});

// 주기적으로 API 캐시 갱신 (5분마다)
setInterval(() => {
  if (navigator.onLine) {
    fetch(
      'https://script.google.com/macros/s/AKfycbx-ktPhpncbuQ3ny78UfN_mgZPq6JAbA8CcLe7-fYQ6A9edGgVgQX19NrSt6btnPv--xA/exec?action=getSeminarSchedule'
    )
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          caches.open(API_CACHE_NAME).then((cache) => {
            cache.put(
              'https://script.google.com/macros/s/AKfycbx-ktPhpncbuQ3ny78UfN_mgZPq6JAbA8CcLe7-fYQ6A9edGgVgQX19NrSt6btnPv--xA/exec?action=getSeminarSchedule',
              new Response(JSON.stringify(data))
            );
          });
        }
      })
      .catch(() => {
        console.log('백그라운드 캐시 업데이트 실패');
      });
  }
}, 5 * 60 * 1000);
