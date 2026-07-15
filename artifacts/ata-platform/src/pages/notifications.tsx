import React, { useEffect } from 'react';
import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
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

const TYPE_COLORS: Record<string, string> = {
  bet_won: 'border-l-emerald-500',
  deposit_received: 'border-l-teal-500',
  withdrawal_approved: 'border-l-teal-400',
  bet_matched: 'border-l-amber-500',
  near_match: 'border-l-amber-400',
  withdrawal_rejected: 'border-l-red-500',
  bet_lost: 'border-l-red-400',
  low_balance: 'border-l-orange-500',
  stream_expiring: 'border-l-orange-400',
  bet_refunded: 'border-l-slate-400',
  match_result: 'border-l-slate-400',
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
    <div className="max-w-2xl mx-auto">
      <Card className="border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden">
        {/* Header */}
        <CardHeader className="border-b border-slate-800 px-5 py-4 bg-slate-900/80">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
              <Bell className="h-5 w-5 text-teal-400" />
              Notifications
              {unreadCount > 0 && (
                <Badge className="bg-amber-500 text-slate-950 text-xs px-1.5 py-0">{unreadCount} new</Badge>
              )}
            </CardTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAll}
                className="text-xs text-slate-400 hover:text-teal-400 hover:bg-slate-800 gap-1.5"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>
          <p className="text-slate-500 text-xs mt-0.5">Real-time alerts for your predictions, deposits, and activity.</p>
        </CardHeader>

        {/* Body */}
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-slate-800/60">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-4">
                  <Skeleton className="h-9 w-9 rounded-full bg-slate-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-2/5 bg-slate-800 rounded" />
                    <Skeleton className="h-3 w-3/4 bg-slate-800/60 rounded" />
                    <Skeleton className="h-2.5 w-1/4 bg-slate-800/40 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="h-14 w-14 rounded-full bg-slate-800/60 flex items-center justify-center mb-4">
                <Bell className="h-6 w-6 text-slate-600" />
              </div>
              <p className="text-slate-300 font-medium">You're all caught up</p>
              <p className="text-slate-500 text-sm mt-1">Alerts for predictions, deposits, and streams will appear here.</p>
            </div>
          ) : (
            <ScrollArea className="h-[560px]">
              <div className="divide-y divide-slate-800/50">
                {notifications.map((n: any) => (
                  <div
                    key={n.id}
                    className={`
                      flex items-start gap-3 px-5 py-4 border-l-[3px] transition-colors
                      ${n.read
                        ? 'border-l-transparent bg-transparent hover:bg-slate-800/20'
                        : `${TYPE_COLORS[n.type] ?? 'border-l-teal-500'} bg-slate-800/25 hover:bg-slate-800/40`
                      }
                    `}
                  >
                    {/* Icon bubble */}
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-base ${n.read ? 'bg-slate-800/50' : 'bg-slate-800'}`}>
                      {TYPE_ICONS[n.type] || '🔔'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-sm leading-tight ${n.read ? 'text-slate-400' : 'text-white'}`}>
                          {n.title}
                        </span>
                        {!n.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-slate-400 text-sm mt-0.5 leading-snug">{n.message}</p>
                      <p className="text-slate-600 text-xs mt-1.5">
                        {new Date(n.createdAt).toLocaleDateString('en-UG', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>

                    {/* Mark read button */}
                    {!n.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-slate-600 hover:text-teal-400 hover:bg-slate-800"
                        title="Mark as read"
                        onClick={() => handleMarkRead(n.id)}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
