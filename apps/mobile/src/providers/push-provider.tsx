import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import {
  getMessaging, getToken, requestPermission, AuthorizationStatus,
  onMessage, onTokenRefresh, onNotificationOpenedApp, getInitialNotification,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { api } from '@/lib/api';

// Firebase Messaging is native-only. Web preview (Expo) has no default app,
// so skip it there — real Android/iOS builds keep the full push behaviour.
const messaging = Platform.OS === 'web' ? null : getMessaging();

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

    (async () => {
      try {
        const granted = await requestPushPermission();
        if (!granted) return;
        const token = await getToken(messaging);
        await register(token);
      } catch { /* push unavailable on this device/build */ }
    })();

    const refresh = onTokenRefresh(messaging, (token) => { void register(token); });
    return () => { active = false; refresh(); };
  }, [status, authedFetch]);

  useEffect(() => {
    if (!messaging) return;
    const showForeground = onMessage(messaging, async (remote: RemoteMessage) => {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: remote.notification?.title ?? 'ATA Sports Live',
          body: remote.notification?.body ?? '',
          data: (remote.data ?? {}) as Record<string, string>,
        },
        trigger: null,
      });
    });

    const open = (data: { [key: string]: string } | undefined) => {
      const url = data?.url;
      if (typeof url === 'string' && url.length > 0) router.push(url as never);
    };

    const openedApp = onNotificationOpenedApp(messaging, (remote: RemoteMessage) => open(remote.data as Record<string, string> | undefined));
    void getInitialNotification(messaging).then((remote) => { if (remote) open(remote.data as Record<string, string> | undefined); });

    return () => { showForeground(); openedApp(); };
  }, []);

  return <>{children}</>;
}
