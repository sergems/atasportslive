import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MonitorSmartphone, RefreshCw, LogOut, Clock, Wifi, WifiOff, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth-store';
import { formatDistanceToNow } from 'date-fns';

function authHeaders() {
  const token = useAuthStore.getState().token;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

type SessionUser = {
  id: number;
  fullName: string;
  email: string;
  role: 'user' | 'content_editor' | 'manager' | 'admin';
  status: 'active' | 'suspended';
  updatedAt: string;
  onlineNow: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  content_editor: 'Editor',
  user: 'User',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-500/15 text-red-400 border-red-500/30',
  manager: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  content_editor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  user: 'bg-slate-700 text-slate-300 border-slate-600',
};

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function AvatarCircle({ name, online }: { name: string; online: boolean }) {
  return (
    <div className="relative flex-shrink-0">
      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-semibold text-slate-200">
        {initials(name)}
      </div>
      <span
        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
          online ? 'bg-emerald-500' : 'bg-slate-600'
        }`}
      />
    </div>
  );
}

export default function AdminSessions() {
  const queryClient = useQueryClient();
  const [kickTarget, setKickTarget] = useState<SessionUser | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery<SessionUser[]>({
    queryKey: ['admin-sessions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/sessions', { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch sessions');
      return res.json();
    },
    refetchInterval: 15_000,
  });

  const kickMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/admin/sessions/${userId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to force logout');
    },
    onSuccess: () => {
      toast.success('Session ended', { description: `${kickTarget?.fullName} has been logged out.` });
      setKickTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-sessions'] });
    },
    onError: () => {
      toast.error('Failed to end session');
      setKickTarget(null);
    },
  });

  const sessions = data ?? [];
  const onlineCount = sessions.filter((s) => s.onlineNow).length;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <MonitorSmartphone className="h-5 w-5 text-teal-400" />
            Active Sessions
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Users with live sessions — force-logout any account remotely.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-slate-700 text-slate-300 hover:bg-slate-800"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="py-4 px-5">
            <div className="text-2xl font-bold text-white">{isLoading ? '—' : sessions.length}</div>
            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <Users className="h-3 w-3" /> Total active sessions
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="py-4 px-5">
            <div className="text-2xl font-bold text-emerald-400">{isLoading ? '—' : onlineCount}</div>
            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <Wifi className="h-3 w-3 text-emerald-400" /> Online now (WS connected)
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="py-4 px-5">
            <div className="text-2xl font-bold text-slate-400">
              {isLoading ? '—' : sessions.length - onlineCount}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <WifiOff className="h-3 w-3" /> Session token only
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions list */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-3 border-b border-slate-800">
          <CardTitle className="text-sm font-medium text-slate-300">
            All Active Sessions
            {!isLoading && (
              <Badge className="ml-2 bg-teal-500/15 text-teal-400 border-teal-500/30 text-xs">
                {sessions.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-slate-800">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <Skeleton className="w-10 h-10 rounded-full bg-slate-800" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-40 bg-slate-800" />
                    <Skeleton className="h-3 w-56 bg-slate-800" />
                  </div>
                  <Skeleton className="h-7 w-24 bg-slate-800 rounded" />
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ShieldCheck className="h-10 w-10 text-slate-700 mb-3" />
              <p className="text-slate-400 text-sm font-medium">No active sessions</p>
              <p className="text-slate-600 text-xs mt-1">All users are currently logged out.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-800/40 transition-colors">
                  <AvatarCircle name={s.fullName} online={s.onlineNow} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">{s.fullName}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 border ${ROLE_COLORS[s.role]}`}>
                        {ROLE_LABELS[s.role]}
                      </Badge>
                      {s.status === 'suspended' && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-red-500/15 text-red-400 border-red-500/30">
                          Suspended
                        </Badge>
                      )}
                      {s.onlineNow ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                          <Wifi className="h-2.5 w-2.5" /> Online
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-slate-500">
                          <WifiOff className="h-2.5 w-2.5" /> Offline
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-slate-400 truncate">{s.email}</span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-600 flex-shrink-0">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDistanceToNow(new Date(s.updatedAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 text-xs h-8"
                    onClick={() => setKickTarget(s)}
                  >
                    <LogOut className="h-3.5 w-3.5 mr-1.5" />
                    Force Logout
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm dialog */}
      <AlertDialog open={!!kickTarget} onOpenChange={(o) => !o && setKickTarget(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Force logout {kickTarget?.fullName}?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This will immediately invalidate their session token and disconnect them
              {kickTarget?.onlineNow ? ' via WebSocket' : ''}. They will be redirected to the
              login page on their next request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 text-slate-300 hover:bg-slate-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => kickTarget && kickMutation.mutate(kickTarget.id)}
              disabled={kickMutation.isPending}
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              End Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
