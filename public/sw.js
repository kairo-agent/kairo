// KAIRO Service Worker - Web Push Notifications
// This file must be at the root of public/ to have full scope

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = {
      title: 'KAIRO',
      body: event.data.text(),
      url: '/leads',
    };
  }

  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: data.tag || 'kairo-notification',
    renotify: true,
    data: {
      url: data.url || '/leads',
    },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'KAIRO', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/leads';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Try to focus an existing KAIRO tab
      for (const client of windowClients) {
        if (client.url.includes('kairoagent.com') || client.url.includes('localhost')) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // No existing tab, open new one
      return clients.openWindow(targetUrl);
    })
  );
});

// Activate immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
