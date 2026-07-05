import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { useAuth } from '@/lib/auth';
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
  ChevronLeft,
  ChevronRight,
  MonitorSmartphone,
  Tv2,
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

function useNeedsSettlementCount() {
  const token = useAuthStore.getState().token;
  return useQuery({
    queryKey: ['admin-settlement-count'],
    queryFn: async () => {
      if (!token) return 0;
      const res = await fetch('/api/games?status=live&limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return 0;
      const data = await res.json();
      const games: any[] = data.games || [];
      return games.filter((g) => g.matchedBetsCount > 0).length;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

// minLevel: 1=content_editor, 2=manager, 3=admin
const ROLE_LEVELS: Record<string, number> = {
  user: 0, content_editor: 1, manager: 2, admin: 3,
};

const navItems = [
  { href: '/admin',                  label: 'Dashboard',     icon: LayoutDashboard, exact: true,          minLevel: 1 },
  { href: '/admin/slides',           label: 'Hero Slides',   icon: GalleryHorizontalEnd,                  minLevel: 1 },
  { href: '/admin/highlights',       label: 'Highlights',    icon: Clapperboard,                          minLevel: 1 },
  { href: '/admin/announcements',    label: 'Announcements', icon: Megaphone,                             minLevel: 1 },
  { href: '/admin/ads',              label: 'Ad Slots',      icon: ImagePlus,                             minLevel: 1 },
  { href: '/admin/users',            label: 'Manage Users',  icon: Users,                                 minLevel: 1 },
  { href: '/admin/streams',             label: 'Streams',             icon: Trophy, settleBadge: true,             minLevel: 2 },
  { href: '/admin/games',               label: 'Livestream',          icon: Radio,                                 minLevel: 2 },
  { href: '/admin/livestream-settings', label: 'Livestream Settings', icon: Tv2,                                   minLevel: 2 },
  { href: '/admin/bets',                label: 'Manage Bets',         icon: Swords,                                minLevel: 2 },
  { href: '/admin/wallets',          label: 'Wallets',       icon: Wallet,                                minLevel: 2 },
  { href: '/admin/withdrawals',      label: 'Withdrawals',   icon: ArrowUpRight, badge: true,             minLevel: 2 },
  { href: '/admin/promotions',       label: 'Promotions',    icon: Gift,                                  minLevel: 2 },
  { href: '/admin/vouchers',         label: 'Vouchers',      icon: Ticket,                                minLevel: 2 },
  { href: '/admin/reports',          label: 'Reports',       icon: BarChart2,                             minLevel: 2 },
  { href: '/admin/sessions',         label: 'Sessions',      icon: MonitorSmartphone,                     minLevel: 3 },
  { href: '/admin/settings',         label: 'Settings',      icon: Settings,                              minLevel: 2 },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useAuth();
  const userLevel = ROLE_LEVELS[user?.role ?? ''] ?? 0;
  const visibleNavItems = navItems.filter(item => userLevel >= item.minLevel);
  
  // Sidebar collapsed state
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('admin-sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('admin-sidebar-collapsed', JSON.stringify(collapsed));
  }, [collapsed]);

  const { data: pendingCount = 0 } = usePendingWithdrawalCount();
  const { data: approvedCount = 0 } = useApprovedWithdrawalCount();
  const { data: settlementCount = 0 } = useNeedsSettlementCount();

  const isActive = (href: string, exact?: boolean) =>
    exact ? location === href : location.startsWith(href);

  const NavContent = ({ onNav, isIconOnly = false }: { onNav?: () => void, isIconOnly?: boolean }) => (
    <nav className="flex flex-col gap-1">
      {visibleNavItems.map(({ href, label, icon: Icon, exact, badge, settleBadge }) => {
        const active = isActive(href, exact);
        const isWithdrawals = badge;
        const isGames = settleBadge;
        return (
          <Link key={href} href={href} onClick={onNav} title={isIconOnly ? label : undefined}>
            <div
              className={`flex items-center ${isIconOnly ? 'justify-center w-8 h-8 rounded-lg mx-auto' : 'gap-3 px-2 py-2 rounded-lg'} text-sm font-medium transition-colors cursor-pointer
                ${active
                  ? (isIconOnly ? 'bg-teal-500/15 text-teal-400' : 'bg-teal-500/15 text-teal-400 border-l-2 border-teal-500 rounded-l-none')
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              <Icon className={`shrink-0 ${isIconOnly ? 'h-4 w-4' : 'h-4 w-4'} ${active ? 'text-teal-400' : ''}`} />
              {!isIconOnly && <span className="flex-1">{label}</span>}
              {!isIconOnly && isGames && settlementCount > 0 && (
                <span
                  title={`${settlementCount} live game${settlementCount !== 1 ? 's' : ''} need${settlementCount === 1 ? 's' : ''} settling`}
                  className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-bold flex items-center justify-center leading-none animate-pulse"
                >
                  {settlementCount > 99 ? '99+' : settlementCount}
                </span>
              )}
              {!isIconOnly && isWithdrawals && (
                <span className="flex items-center gap-1">
                  {pendingCount > 0 && (
                    <span
                      title={`${pendingCount} pending — needs your review`}
                      className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold flex items-center justify-center leading-none"
                    >
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                  {approvedCount > 0 && (
                    <span
                      title={`${approvedCount} approved — awaiting finance payment`}
                      className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] font-bold flex items-center justify-center leading-none"
                    >
                      {approvedCount > 99 ? '99+' : approvedCount}
                    </span>
                  )}
                </span>
              )}
              {isIconOnly && (isGames && settlementCount > 0 || isWithdrawals && (pendingCount > 0 || approvedCount > 0)) && (
                 <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500"></span>
              )}
            </div>
          </Link>
        );
      })}
    </nav>
  );

  const currentItem = visibleNavItems.find(({ href, exact }) => isActive(href, exact));

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex flex-col border-r border-slate-800 bg-slate-900/60 pt-4 pb-4 transition-all duration-200 ${collapsed ? 'w-12 px-1' : 'w-[200px] px-2'}`}>
        <div className={`mb-4 ${collapsed ? 'text-center' : 'px-2'}`}>
          <span className={`text-[10px] font-semibold uppercase tracking-widest text-slate-500 ${collapsed ? 'hidden' : 'block'}`}>Admin</span>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
          <NavContent isIconOnly={collapsed} />
        </div>
        <div className="mt-auto pt-2 flex justify-center border-t border-slate-800/50">
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors hidden lg:block"
          >
             {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile: top bar with hamburger */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile nav bar */}
        <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/80 sticky top-16 z-40">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center justify-center h-8 w-8 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
            aria-label="Open admin menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest shrink-0">Admin</span>
            {currentItem && (
              <>
                <span className="text-slate-700 text-xs">/</span>
                <span className="text-xs font-semibold text-white truncate">{currentItem.label}</span>
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
            <aside className="relative w-64 max-w-[80vw] bg-slate-900 border-r border-slate-800 flex flex-col pt-4 pb-4 px-2 h-full overflow-y-auto">
              <div className="flex items-center justify-between px-2 mb-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Admin</span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center justify-center h-7 w-7 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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
        <main className="flex-1 overflow-auto px-3 py-3 md:px-5 md:py-4">
          {children}
        </main>
      </div>
    </div>
  );
}
