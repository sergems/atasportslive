import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getGetWalletQueryKey,
  getListNotificationsQueryKey,
  getListTransactionsQueryKey,
  getListMyBetsQueryKey,
  getGetAdminStatsQueryKey,
} from '@workspace/api-client-react';

export function useWebSocket() {
  const { token, user, clearAuth } = useAuthStore();
  const isAuthenticated = !!token;
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    let destroyed = false;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (destroyed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'session_displaced':
              // Another device signed in — stop reconnecting, show warning, log out
              destroyed = true;
              clearTimeout(reconnectTimeout);
              ws.close();
              toast.error('Signed out — another device logged in', {
                description: 'Your account was accessed on another device. For your security, this session has been ended.',
                duration: 12000,
              });
              setTimeout(() => clearAuth(), 1500);
              break;
            case 'bet_matched':
              toast.success(data.title || 'Bet Matched', { description: data.message });
              queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
              queryClient.invalidateQueries({ queryKey: getListMyBetsQueryKey() });
              queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
              break;
            case 'near_match':
              toast.info(data.title || 'Near Match', { description: data.message });
              queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
              break;
            case 'deposit_received':
              toast.success(data.title || 'Deposit Received', { description: data.message });
              queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
              queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
              queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
              break;
            case 'withdrawal_approved':
            case 'withdrawal_rejected':
              toast.info(data.title, { description: data.message });
              queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
              queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
              queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
              break;
            case 'stream_expiring':
              toast.warning(data.title || 'Stream Expiring', { description: data.message });
              queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
              break;
            case 'bet_won':
              toast.success(data.title || 'You Won!', { description: data.message, duration: 6000 });
              queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
              queryClient.invalidateQueries({ queryKey: getListMyBetsQueryKey() });
              queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
              break;
            case 'bet_lost':
              toast.error(data.title || 'Bet Lost', { description: data.message });
              queryClient.invalidateQueries({ queryKey: getListMyBetsQueryKey() });
              queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
              break;
            case 'bet_refunded':
              toast.info(data.title || 'Bet Refunded', { description: data.message });
              queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
              queryClient.invalidateQueries({ queryKey: getListMyBetsQueryKey() });
              queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
              break;
            case 'low_balance':
              toast.warning(data.title || 'Low Balance', { description: data.message, duration: 8000 });
              queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
              break;
            case 'match_result':
              queryClient.invalidateQueries({ queryKey: getListMyBetsQueryKey() });
              queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
              queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
              break;
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = (event) => {
        // Errors are followed by onclose, which handles reconnection
        console.warn('[WS] Connection error', event);
      };

      ws.onclose = () => {
        if (!destroyed) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      destroyed = true;
      clearTimeout(reconnectTimeout);
      wsRef.current?.close();
    };
  }, [isAuthenticated, user?.id, queryClient]);
}
