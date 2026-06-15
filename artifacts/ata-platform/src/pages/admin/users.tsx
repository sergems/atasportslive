import React, { useEffect, useState } from 'react';
import { useListUsers, useUpdateUserRole, useSuspendUser } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Search, Shield, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { getListUsersQueryKey } from '@workspace/api-client-react';

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  moderator: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  user: 'bg-slate-700 text-slate-300 border-slate-600',
};

export default function AdminUsers() {
  useEffect(() => { document.title = 'Manage Users - Admin'; }, []);

  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListUsers({ page, limit: 20, search: search || undefined });
  const updateRole = useUpdateUserRole();
  const suspend = useSuspendUser();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const handleRole = async (id: number, role: string) => {
    try {
      await updateRole.mutateAsync({ id, data: { role } });
      invalidate();
      toast.success('Role updated');
    } catch (err: any) { toast.error(err?.data?.error || 'Failed'); }
  };

  const handleSuspend = async (id: number, suspended: boolean) => {
    try {
      await suspend.mutateAsync({ id, data: { suspended } });
      invalidate();
      toast.success(suspended ? 'User suspended' : 'User reactivated');
    } catch (err: any) { toast.error(err?.data?.error || 'Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Users className="h-6 w-6 text-blue-400" /> Manage Users</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="pl-9 bg-slate-800 border-slate-700 text-white" />
        </div>
      </div>

      <Card className="bg-slate-900 border-primary/20">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 bg-slate-800 rounded" />)}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">User</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Role</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Joined</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.users || []).map((user: any) => (
                  <tr key={user.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <div className="text-white font-medium">{user.fullName}</div>
                      <div className="text-slate-500 text-xs">{user.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={user.role}
                        onChange={(e) => handleRole(user.id, e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs"
                      >
                        <option value="user">User</option>
                        <option value="moderator">Moderator</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={`border text-xs ${user.status === 'active' ? 'bg-teal-500/20 text-teal-400 border-teal-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSuspend(user.id, user.status === 'active')}
                        className={`h-7 text-xs ${user.status === 'active' ? 'text-red-400 hover:bg-red-500/10' : 'text-teal-400 hover:bg-teal-500/10'}`}
                      >
                        {user.status === 'active' ? <><Ban className="h-3 w-3 mr-1" />Suspend</> : 'Reactivate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data && data.total > 20 && (
            <div className="flex justify-between items-center p-4 border-t border-slate-800">
              <span className="text-slate-400 text-sm">{data.total} total users</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="text-slate-400">Prev</Button>
                <span className="text-slate-400 text-sm py-1">Page {page}</span>
                <Button size="sm" variant="ghost" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= data.total} className="text-slate-400">Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
