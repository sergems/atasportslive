import React, { useEffect } from 'react';
import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { getListNotificationsQueryKey } from '@workspace/api-client-react';

const TYPE_ICONS: Record<string, string> = {
  bet_matched: '🎯',
  near_match: '🔔',
  deposit_received: '💰',
  withdrawal_approved: '✅',
  withdrawal_rejected: '❌',
  stream_expiring: '⏰',
  bet_won: '🏆',
  bet_lost: '📉',
  match_result: '📊',
  bet_refunded: '↩️',
  low_balance: '⚠️',
};

export default function Notifications() {
  useEffect(() => { document.title = 'Notifications - ATA Platform'; }, []);

  const queryClient = useQueryClient();
  const { data, isLoading } = useListNotifications({ limit: 50 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const handleMarkRead = async (id: number) => {
    await markRead.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
  };

  const handleMarkAll = async () => {
    await markAll.mutateAsync();
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
    toast.success('All notifications marked as read');
  };

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            <Bell className="h-7 w-7 text-teal-400" />
            Notifications
            {unreadCount > 0 && (
              <Badge className="bg-amber-500 text-slate-950 text-xs ml-1">{unreadCount} new</Badge>
            )}
          </h1>
          <p className="text-slate-400 mt-1">Real-time alerts for your activity.</p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAll}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <CheckCheck className="h-4 w-4 mr-1" /> Mark All Read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 bg-slate-800 rounded-xl" />)}</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No notifications yet.</p>
          <p className="text-slate-500 text-sm mt-1">You'll see alerts for bets, deposits, and more here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any) => (
            <Card key={n.id} className={`border transition-colors ${n.read ? 'bg-slate-900/50 border-primary/10' : 'bg-slate-900 border-teal-500/20'}`}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start gap-4">
                  <span className="text-2xl mt-0.5">{TYPE_ICONS[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-sm ${n.read ? 'text-slate-300' : 'text-white'}`}>{n.title}</span>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />}
                    </div>
                    <p className="text-slate-400 text-sm mt-0.5">{n.message}</p>
                    <p className="text-slate-600 text-xs mt-1">
                      {new Date(n.createdAt).toLocaleDateString('en-UG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-teal-400"
                      onClick={() => handleMarkRead(n.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
