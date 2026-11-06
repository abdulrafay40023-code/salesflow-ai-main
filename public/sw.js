self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Fetch event handler required for Chromium beforeinstallprompt
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

self.addEventListener('push', (event) => {
  let data = {
    title: 'Teals CRM Alert',
    body: 'New activity in Teals CRM LiveChat.',
    tag: 'teals_push_' + Date.now(),
    url: '/livechat',
    type: 'visitor',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        let hasVisibleClient = false;

        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.visibilityState === 'visible' || client.focused) {
            hasVisibleClient = true;
          }
          try {
            client.postMessage({
              type: 'TEALS_SW_PUSH_EVENT',
              payload: data,
            });
          } catch (err) {}
        }

        // If the app is already open and visible in front of the user, the in-app WebSocket alert handles it.
        // When the app is closed, minimized, or in the background, show the OS notification WITH SOUND (silent: false)!
        if (hasVisibleClient) {
          return;
        }

        return self.registration.showNotification(data.title, {
          body: data.body,
          icon: '/icon-192.png?v=3',
          badge: '/icon-192.png?v=3',
          tag: data.tag || 'teals_push_' + Date.now(),
          renotify: true,
          silent: false,
          requireInteraction: data.type === 'handoff',
          vibrate: [300, 100, 300, 100, 400],
          data: {
            url: data.url || '/livechat',
            type: data.type || 'visitor',
          },
        });
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/livechat';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if ('focus' in client) {
            return client.focus().then(() => {
              if ('navigate' in client) {
                return client.navigate(targetUrl);
              }
            });
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
