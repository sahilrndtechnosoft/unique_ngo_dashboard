import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { api } from './api';
import { showAlert } from '../utils/alerts';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const deviceIdKey = 'unique_ngo_fcm_device_id';
let registeredTokenKey: string | null = null;

function hasFirebaseConfig() {
    return Boolean(vapidKey) && Object.values(firebaseConfig).every(Boolean);
}

function getDeviceId() {
    const existing = localStorage.getItem(deviceIdKey);
    if (existing) return existing;
    const next = crypto.randomUUID();
    localStorage.setItem(deviceIdKey, next);
    return next;
}

function serviceWorkerUrl() {
    const params = new URLSearchParams(firebaseConfig);
    return `/firebase-messaging-sw.js?${params.toString()}`;
}

export async function registerFcmNotifications(userId: string) {
    if (!hasFirebaseConfig() || !('Notification' in window) || !('serviceWorker' in navigator) || !(await isSupported())) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    const messaging = getMessaging(app);
    const serviceWorkerRegistration = await navigator.serviceWorker.register(serviceWorkerUrl());
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration });

    if (token && registeredTokenKey !== `${userId}:${token}`) {
        await api.post('/notifications/device-tokens', { token, platform: 'WEB', deviceId: getDeviceId() });
        registeredTokenKey = `${userId}:${token}`;
    }

    return onMessage(messaging, (payload) => {
        const title = payload.notification?.title ?? payload.data?.title;
        const body = payload.notification?.body ?? payload.data?.body;
        showAlert([title, body].filter(Boolean).join(': ') || 'New notification', 'info');
    });
}
