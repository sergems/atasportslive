import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { useAuth } from '@/lib/auth';
import { ArrowUpRight, LayoutDashboard, Menu, X, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

function useApprovedCount() {
  const token = useAuthStore.getState().token;
  return useQuery({
    queryKey: ['finance-approved-count'],
    queryFn: async () => {
      if (!token) return 0;
      const res = await fetch('/api/admin/approved-withdrawals', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return 0;
      const data = await res.json();
      return Array.isArray(data) ? data.length : 0;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

const navItems = [
  { href: '/finance/dashboard', label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/finance/withdrawals', label: 'Payment Queue',  icon: ArrowUpRight, badge: true },
];

export function FinanceLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: approvedCount = 0 } = useApprovedCount();
  const { logout, user } = useAuth();

  const isActive = (href: string) => location.startsWith(href);

  const NavContent = ({ onNav }: { onNav?: () => void }) => (
    <nav className="flex flex-col gap-1 flex-1">
      {navItems.map(({ href, label, icon: Icon, badge }) => {
        const active = isActive(href);
        const showBadge = badge && approvedCount > 0;
        return (
          <Link key={href} href={href} onClick={onNav}>
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              active ? 'bg-teal-500/15 text-teal-400 border border-teal-500/25' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}>
              <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-teal-400' : ''}`} />
              <span className="flex-1">{label}</span>
              {showBadge && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                  {approvedCount > 99 ? '99+' : approvedCount}
                </span>
              )}
            </div>
          </Link>
        );
      })}
      <div className="mt-auto pt-4 border-t border-slate-800">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/10 w-full transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </nav>
  );

  const currentItem = navItems.find(({ href }) => isActive(href));

  return (
    <div className="flex min-h-[calc(100vh-4rem)] -mx-4 md:-mx-6 lg:-mx-8">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-slate-800 bg-slate-900/60 flex-col pt-6 pb-8 px-3">
        <div className="mb-4 px-3 space-y-0.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance Portal</span>
          <p className="text-xs text-slate-600 truncate">{user?.fullName ?? user?.email}</p>
        </div>
        <NavContent />
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/80 sticky top-16 z-40">
          <button onClick={() => setDrawerOpen(true)} className="flex items-center justify-center h-9 w-9 rounded-lg bg-slate-800 text-slate-300 hover:text-white">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-slate-500 uppercase tracking-widest shrink-0">Finance</span>
            {currentItem && <><span className="text-slate-700">/</span><span className="text-sm font-semibold text-white truncate">{currentItem.label}</span></>}
          </div>
        </div>

        {drawerOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
            <aside className="relative w-64 max-w-[80vw] bg-slate-900 border-r border-slate-800 flex flex-col pt-4 pb-8 px-3 h-full overflow-y-auto">
              <div className="flex items-center justify-between px-3 mb-5">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance Portal</span>
                <button onClick={() => setDrawerOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <NavContent onNav={() => setDrawerOpen(false)} />
            </aside>
          </div>
        )}

        <main className="flex-1 overflow-auto px-4 md:px-6 py-4 md:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
