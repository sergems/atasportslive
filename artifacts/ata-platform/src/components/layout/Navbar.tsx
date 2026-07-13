import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Bell, User as UserIcon, Wallet, LayoutDashboard, Trophy, History, LogOut, ChevronDown, Menu, X, Settings, Gift, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useListNotifications, useGetWallet } from '@workspace/api-client-react';
import { useChannelStatus } from '@/hooks/use-channel-status';
import ataLogo from '@assets/cropped-ATA_logo-removebg-preview_1782471649356.png';

function LiveBadge({ channel }: { channel?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/20 border border-red-500/40 px-1.5 py-px text-[9px] font-bold text-red-400 uppercase tracking-wider leading-none">
      <span className="h-1 w-1 rounded-full bg-red-500 animate-pulse" />
      {channel ? `Live ${channel}` : 'Live'}
    </span>
  );
}

function UserMenu({ onLogout, user }: { onLogout: () => void; user: any }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const firstName = user?.fullName?.split(' ')[0] || user?.username || '';

  const items = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/subscriptions', label: 'Subscription', icon: CreditCard },
    { href: '/bets', label: 'My Bets', icon: Trophy },
    { href: '/transactions', label: 'Transactions', icon: History },
    { href: '/profile', label: 'Profile Settings', icon: Settings },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        aria-label="User menu"
      >
        <UserIcon className="h-5 w-5 shrink-0" />
        {firstName && <span className="hidden sm:inline text-sm font-medium text-slate-200">{firstName}</span>}
        <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-lg border border-slate-700 bg-slate-900 shadow-xl py-1 z-50">
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-sm font-semibold text-white truncate">{user?.fullName || user?.username}</p>
            <p className="text-xs text-teal-400 capitalize mt-0.5">{user?.role}</p>
          </div>
          {items.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}>
              <div className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer">
                <Icon className="h-4 w-4 text-slate-500" />
                {label}
              </div>
            </Link>
          ))}
          <div className="my-1 border-t border-slate-800" />
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const { isAuthenticated, logout, isAdmin, isManager, user } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { ch1Live, ch2Live, ch3Live } = useChannelStatus();

  useEffect(() => { setMobileMenuOpen(false); }, [location]);

  const { data: notificationsData } = useListNotifications({ unreadOnly: true }, {
    query: {
      enabled: isAuthenticated,
      queryKey: ['notifications', 'unread'],
      refetchInterval: 30000,
    }
  });

  const { data: wallet } = useGetWallet({
    query: {
      enabled: isAuthenticated,
      queryKey: ['wallet'],
      refetchInterval: 15000,
    }
  });

  const unreadCount = notificationsData?.unreadCount || 0;

  const navLinks = [
    { href: '/', label: 'Home', exact: true, pulse: false, ch1: false },
    { href: '/live', label: 'Livestream', exact: true, pulse: ch1Live, ch1: true },
    ...(ch2Live ? [{ href: '/live-2', label: 'Livestream 2', exact: true, pulse: true, ch1: false }] : []),
    ...(ch3Live ? [{ href: '/live-3', label: 'Livestream 3', exact: true, pulse: true, ch1: false }] : []),
    { href: '/streams', label: 'Events', pulse: false, ch1: false },
    { href: '/upcoming', label: 'Upcoming', pulse: false, ch1: false },
    { href: '/highlights', label: 'Highlights', pulse: false, ch1: false },
    { href: '/fixtures', label: 'Fixtures', pulse: false, ch1: false },
    ...(isAuthenticated ? [{ href: '/games', label: 'Bets', pulse: false, ch1: false }] : []),
  ];

  return (
    <header className="safe-area-header sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-7xl mx-auto px-4 items-center relative">
        {/* Logo - left */}
        <div className="flex items-center shrink-0">
          <Link href="/" className="flex items-center">
            <img src={ataLogo} alt="ATA" className="h-12 w-12 object-contain" />
          </Link>
        </div>

        {/* Nav links - centered absolutely (desktop only) */}
        <nav className="hidden md:flex items-center space-x-4 text-sm font-medium absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
          {navLinks.map(({ href, label, pulse, exact, ch1 }) => {
            const active = exact
              ? location === href
              : location === href || location.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`relative inline-flex items-center gap-1.5 pb-1 transition-colors hover:text-white border-b-2 ${active ? 'text-white border-teal-400' : 'text-slate-400 border-transparent hover:border-slate-600'}`}
              >
                {pulse && ch1 ? (
                  <LiveBadge />
                ) : pulse ? (
                  <LiveBadge channel={href === '/live-2' ? 2 : 3} />
                ) : (
                  label
                )}
              </Link>
            );
          })}
          <a
            href="https://shop.atasportslive.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="relative inline-flex items-center gap-1.5 pb-1 transition-colors hover:text-white text-slate-400 border-b-2 border-transparent hover:border-slate-600"
          >
            E-Shop
          </a>
          {isManager && (
            <Link
              href="/admin"
              className={`transition-colors hover:text-amber-400 ${location.startsWith('/admin') ? 'text-amber-400' : 'text-slate-400'}`}
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Auth actions - right */}
        <div className="flex items-center space-x-2 shrink-0">
          {isAuthenticated ? (
            <>
              <Link href="/wallet">
                <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800 hover:border-teal-500/30 transition-colors cursor-pointer">
                  <Wallet className="h-4 w-4 text-teal-500 shrink-0" />
                  <span className="font-mono text-sm font-semibold text-white">
                    ${(wallet?.balance ?? 0).toFixed(2)}
                  </span>
                  {(wallet?.bonusBalance ?? 0) > 0 && (
                    <>
                      <span className="w-px h-3.5 bg-slate-700" />
                      <span className="flex items-center gap-1">
                        <Gift className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                        <span className="font-mono text-sm font-semibold text-yellow-400">
                          ${(wallet?.bonusBalance ?? 0).toFixed(2)}
                        </span>
                      </span>
                    </>
                  )}
                </div>
              </Link>
              <Link href="/notifications">
                <Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-white">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-amber-500 text-[9px] font-bold text-slate-950 flex items-center justify-center leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Button>
              </Link>
              <UserMenu onLogout={logout} user={user} />
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">Login</Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="bg-teal-500 text-slate-950 hover:bg-teal-400 font-semibold">
                  Join Now
                </Button>
              </Link>
              <button
                onClick={() => setMobileMenuOpen((o) => !o)}
                className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
                aria-label="Open menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile guest dropdown menu */}
      {!isAuthenticated && mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950/98 backdrop-blur px-4 py-3 space-y-1">
          {navLinks.map(({ href, label, pulse, exact }) => {
            const active = exact
              ? location === href
              : location === href || location.startsWith(href + '/');
            return (
              <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)}>
                <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer
                  ${active ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}>
                  {pulse && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
                  {label}
                </div>
              </Link>
            );
          })}
          <a
            href="https://shop.atasportslive.com/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            E-Shop
          </a>
          <div className="pt-1 border-t border-slate-800 mt-1">
            <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-teal-400 hover:text-teal-300 hover:bg-slate-800/60 transition-colors cursor-pointer">
                Login
              </div>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
