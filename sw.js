// sw.js - Service Worker (수정 버전)
const CACHE_NAME = 'seminar-v1';
const API_CACHE_NAME = 'api-cache-v1';

// 캐시할 정적 파일들
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/css/index.css',
  '/assets/js/index.js',
  // '/assets/images/istudy-logo.png', // 로고 파일이 있을 때만 추가
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

  // Chrome Extension 요청은 무시
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // 로컬 파일 시스템 요청은 무시
  if (url.protocol === 'file:') {
    return;
  }

  // DevTools 관련 요청 무시
  if (url.hostname === 'localhost' && url.port === '9229') {
    return;
  }

  // API 요청 처리
  if (url.href.includes('script.google.com')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then((cache) => {
        return fetch(request)
          .then((response) => {
            // 성공하면 캐시에 저장
            if (response && response.status === 200) {
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
          fetch(request)
            .then((fetchResponse) => {
              // 유효한 응답만 캐시
              if (
                !fetchResponse ||
                fetchResponse.status !== 200 ||
                fetchResponse.type === 'opaque'
              ) {
                return fetchResponse;
              }

              // chrome-extension 프로토콜은 캐시하지 않음
              if (request.url.startsWith('chrome-extension://')) {
                return fetchResponse;
              }

              return caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, fetchResponse.clone());
                return fetchResponse;
              });
            })
            .catch(() => {
              // 네트워크 실패 시 캐시된 버전 반환
              return response;
            })
        );
      })
    );
  }
});

// 주기적으로 API 캐시 갱신 (5분마다) - 선택사항
// setInterval은 Service Worker에서 사용 불가, 대신 다른 이벤트 활용
self.addEventListener('message', (event) => {
  if (event.data === 'refresh-cache') {
    fetch(
      'https://script.google.com/macros/s/AKfycbx-ktPhpncbuQ3ny78UfN_mgZPq6JAbA8CcLe7-fYQ6A9edGgVgQX19NrSt6btnPv--xA/exec?action=getSeminarSchedule'
    )
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          caches.open(API_CACHE_NAME).then((cache) => {
            const response = new Response(JSON.stringify(data), {
              headers: { 'Content-Type': 'application/json' },
            });
            cache.put(
              'https://script.google.com/macros/s/AKfycbx-ktPhpncbuQ3ny78UfN_mgZPq6JAbA8CcLe7-fYQ6A9edGgVgQX19NrSt6btnPv--xA/exec?action=getSeminarSchedule',
              response
            );
          });
        }
      })
      .catch(() => {
        console.log('백그라운드 캐시 업데이트 실패');
      });
  }
});
