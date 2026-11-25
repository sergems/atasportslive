import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import {
  getMessaging, getToken, requestPermission, AuthorizationStatus,
  onMessage, onTokenRefresh, onNotificationOpenedApp, getInitialNotification,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications';
import { router } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { api } from '@/lib/api';

// Firebase Messaging is native-only. Expo Go and misconfigured dev builds have
// no default Firebase app, so a missing module must not crash the whole app.
function messagingSafe() {
  if (Platform.OS === 'web') return null;
  try {
    return getMessaging();
  } catch {
    return null;
  }
}

const messaging = messagingSafe();

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
  if (!messaging) return false;
  await prepareChannel();
  const status = await requestPermission(messaging);
  return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
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
    if (status !== 'authenticated' || !messaging) return;
    let active = true;

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
        await register(await getToken(messaging));
      } catch { /* push unavailable on this device/build */ }
    })();

    const refresh = onTokenRefresh(messaging, (token) => { void register(token); });
    return () => { active = false; refresh(); };
  }, [status, authedFetch]);

  useEffect(() => {
    if (!messaging) return;
    const showForeground = onMessage(messaging, (remote: RemoteMessage) => {
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

    const openedApp = onNotificationOpenedApp(messaging, (remote: RemoteMessage) => {
      openInternalUrl(remote.data?.url);
    });
    void getInitialNotification(messaging)
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
