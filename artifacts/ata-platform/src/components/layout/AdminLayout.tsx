import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import {
  LayoutDashboard,
  Radio,
  Trophy,
  Users,
  Wallet,
  BarChart2,
  Ticket,
  Megaphone,
  Clapperboard,
  Settings,
  GalleryHorizontalEnd,
  ArrowUpRight,
  Menu,
  X,
  ImagePlus,
  Gift,
  Swords,
} from 'lucide-react';

function usePendingWithdrawalCount() {
  const token = useAuthStore.getState().token;
  return useQuery({
    queryKey: ['admin-withdrawals-count'],
    queryFn: async () => {
      if (!token) return 0;
      const res = await fetch('/api/admin/pending-withdrawals', {
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

function useApprovedWithdrawalCount() {
  const token = useAuthStore.getState().token;
  return useQuery({
    queryKey: ['admin-approved-count'],
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
  { href: '/admin',                  label: 'Dashboard',     icon: LayoutDashboard, exact: true },
  { href: '/admin/slides',           label: 'Hero Slides',   icon: GalleryHorizontalEnd },
  { href: '/admin/streams',          label: 'Streams',       icon: Radio },
  { href: '/admin/games',            label: 'Games',         icon: Trophy },
  { href: '/admin/bets',             label: 'Bets',          icon: Swords },
  { href: '/admin/highlights',       label: 'Highlights',    icon: Clapperboard },
  { href: '/admin/announcements',    label: 'Announcements', icon: Megaphone },
  { href: '/admin/users',            label: 'Users',         icon: Users },
  { href: '/admin/wallets',          label: 'Wallets',       icon: Wallet },
  { href: '/admin/withdrawals',      label: 'Withdrawals',   icon: ArrowUpRight, badge: true },
  { href: '/admin/promotions',       label: 'Promotions',    icon: Gift },
  { href: '/admin/vouchers',         label: 'Vouchers',      icon: Ticket },
  { href: '/admin/ads',              label: 'Ad Slots',      icon: ImagePlus },
  { href: '/admin/reports',          label: 'Reports',       icon: BarChart2 },
  { href: '/admin/settings',         label: 'Settings',      icon: Settings },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: pendingCount = 0 } = usePendingWithdrawalCount();
  const { data: approvedCount = 0 } = useApprovedWithdrawalCount();

  const isActive = (href: string, exact?: boolean) =>
    exact ? location === href : location.startsWith(href);

  const NavContent = ({ onNav }: { onNav?: () => void }) => (
    <nav className="flex flex-col gap-1">
      {navItems.map(({ href, label, icon: Icon, exact, badge }) => {
        const active = isActive(href, exact);
        const isWithdrawals = badge;
        return (
          <Link key={href} href={href} onClick={onNav}>
            <div
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer
                ${active
                  ? 'bg-teal-500/15 text-teal-400 border border-teal-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-teal-400' : ''}`} />
              <span className="flex-1">{label}</span>
              {isWithdrawals && (
                <span className="flex items-center gap-1">
                  {pendingCount > 0 && (
                    <span
                      title={`${pendingCount} pending — needs your review`}
                      className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center leading-none"
                    >
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                  {approvedCount > 0 && (
                    <span
                      title={`${approvedCount} approved — awaiting finance payment`}
                      className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center leading-none"
                    >
                      {approvedCount > 99 ? '99+' : approvedCount}
                    </span>
                  )}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </nav>
  );

  const currentItem = navItems.find(({ href, exact }) => isActive(href, exact));

  return (
    <div className="flex min-h-[calc(100vh-4rem)] -mx-4 md:-mx-6 lg:-mx-8">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-slate-800 bg-slate-900/60 flex-col pt-6 pb-8 px-3">
        <div className="mb-6 px-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Admin Panel</span>
        </div>
        <NavContent />
      </aside>

      {/* Mobile: top bar with hamburger */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile nav bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/80 sticky top-16 z-40">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
            aria-label="Open admin menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-slate-500 uppercase tracking-widest shrink-0">Admin</span>
            {currentItem && (
              <>
                <span className="text-slate-700">/</span>
                <span className="text-sm font-semibold text-white truncate">{currentItem.label}</span>
              </>
            )}
          </div>
        </div>

        {/* Mobile drawer overlay */}
        {drawerOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            {/* Drawer */}
            <aside className="relative w-64 max-w-[80vw] bg-slate-900 border-r border-slate-800 flex flex-col pt-4 pb-8 px-3 h-full overflow-y-auto">
              <div className="flex items-center justify-between px-3 mb-5">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Admin Panel</span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <NavContent onNav={() => setDrawerOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto px-4 md:px-6 py-4 md:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
