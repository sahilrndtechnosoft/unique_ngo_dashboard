importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

const config = Object.fromEntries(new URL(self.location.href).searchParams.entries());

firebase.initializeApp(config);

firebase.messaging().onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'New notification';
  const body = payload.notification?.body || payload.data?.body || '';

  self.registration.showNotification(title, { body });
});
