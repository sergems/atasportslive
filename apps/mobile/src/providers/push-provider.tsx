import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications';
import { router } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { api } from '@/lib/api';
import type { RemoteMessage } from '@react-native-firebase/messaging';

type FirebaseMessaging = typeof import('@react-native-firebase/messaging');

let firebase: FirebaseMessaging | null = null;

/**
 * Firebase Messaging ships no native module in Expo Go or on web. Importing it
 * at module scope crashes the whole app there, so load it lazily only in a
 * native build.
 */
function getFirebase(): FirebaseMessaging | null {
  if (Platform.OS === 'web' || Constants.expoVersion) return null;
  if (!firebase) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      firebase = require('@react-native-firebase/messaging') as FirebaseMessaging;
    } catch {
      return null;
    }
  }
  return firebase;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function prepareChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('ata-default', {
    name: 'ATA Sports Live',
    description: 'Live streams, results and wallet updates',
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

export async function requestPushPermission(): Promise<boolean> {
  const fb = getFirebase();
  if (!fb) return false;
  await prepareChannel();
  const status = await fb.requestPermission(fb.getMessaging());
  return status === fb.AuthorizationStatus.AUTHORIZED || status === fb.AuthorizationStatus.PROVISIONAL;
}

/** Only internal app paths may be used as notification deep links. */
function openInternalUrl(value: unknown) {
  if (typeof value !== 'string') return;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('://')) return;
  try {
    router.push(value as never);
  } catch { /* ignore malformed routes from the server */ }
}

/** Registers the FCM token with our backend and handles notification taps. */
export function PushProvider({ children }: { children: React.ReactNode }) {
  const { status, authedFetch } = useAuth();

  useEffect(() => {
    if (status !== 'authenticated') return;
    const fb = getFirebase();
    if (!fb) return;
    let active = true;
    const messaging = fb.getMessaging();

    const register = async (fcmToken: string) => {
      if (!active || !fcmToken) return;
      try {
        await authedFetch((t) => api.registerPushToken(t, fcmToken, Platform.OS));
      } catch { /* retry on next launch or token refresh */ }
    };

    void (async () => {
      try {
        const granted = await requestPushPermission();
        if (!granted) return;
        await register(await fb.getToken(messaging));
      } catch { /* push unavailable on this device/build */ }
    })();

    const refresh = fb.onTokenRefresh(messaging, (token) => { void register(token); });
    return () => { active = false; refresh(); };
  }, [status, authedFetch]);

  useEffect(() => {
    const fb = getFirebase();
    if (!fb) return;
    const messaging = fb.getMessaging();

    const showForeground = fb.onMessage(messaging, (remote: RemoteMessage) => {
      void Notifications.scheduleNotificationAsync({
        content: {
          title: remote.notification?.title ?? 'ATA Sports Live',
          body: remote.notification?.body ?? '',
          data: (remote.data ?? {}) as Record<string, string>,
        },
        trigger: {
          type: SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 0,
          channelId: 'ata-default',
        },
      }).catch(() => {});
    });

    const openedApp = fb.onNotificationOpenedApp(messaging, (remote: RemoteMessage) => {
      openInternalUrl(remote.data?.url);
    });
    void fb.getInitialNotification(messaging)
      .then((remote) => { if (remote) openInternalUrl(remote.data?.url); })
      .catch(() => {});

    // Foreground taps are re-presented as local notifications, so they need
    // the expo-notifications response listener to navigate.
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      openInternalUrl(event.notification.request.content.data?.url);
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
    });
    void Notifications.getLastNotificationResponseAsync()
      .then((event) => { if (event) openInternalUrl(event.notification.request.content.data?.url); })
      .catch(() => {});

    return () => {
      showForeground();
      openedApp();
      response.remove();
    };
  }, []);

  return <>{children}</>;
}
