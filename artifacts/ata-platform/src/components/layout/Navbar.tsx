import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Bell, User as UserIcon, Wallet, LayoutDashboard, Trophy, History, LogOut, ChevronDown, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useListNotifications, useGetWallet } from '@workspace/api-client-react';
import ataLogo from '@assets/cropped-ATA_logo-removebg-preview_1782471649356.png';

function UserMenu({ onLogout }: { onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const items = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/bets', label: 'My Bets', icon: Trophy },
    { href: '/transactions', label: 'Transactions', icon: History },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        aria-label="User menu"
      >
        <UserIcon className="h-5 w-5" />
        <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-lg border border-slate-700 bg-slate-900 shadow-xl py-1 z-50">
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
  const { isAuthenticated, logout, isAdmin } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on navigation
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
    { href: '/live', label: 'Live', pulse: true, mobileHide: true },
    { href: '/streams', label: 'Streams' },
    { href: '/upcoming', label: 'Upcoming' },
    { href: '/highlights', label: 'Highlights' },
    { href: '/fixtures', label: 'Fixtures' },
    ...(isAuthenticated ? [{ href: '/games', label: 'Games' }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-7xl mx-auto px-4 items-center">
        {/* Logo - left */}
        <div className="flex items-center shrink-0">
          <Link href="/" className="flex items-center">
            <img src={ataLogo} alt="ATA" className="h-12 w-12 object-contain" />
          </Link>
        </div>

        {/* Nav links - centered (desktop only) */}
        <nav className="hidden md:flex flex-1 items-center justify-center space-x-6 text-sm font-medium">
          {navLinks.map(({ href, label, pulse }) => (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-1.5 transition-colors hover:text-white ${location.startsWith(href) ? 'text-white' : 'text-slate-400'}`}
            >
              {pulse && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
              {label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className={`transition-colors hover:text-amber-400 ${location.startsWith('/admin') ? 'text-amber-400' : 'text-slate-400'}`}
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Spacer on mobile */}
        <div className="flex-1 md:hidden" />

        {/* Auth actions - right */}
        <div className="flex items-center space-x-2 shrink-0">
          {isAuthenticated ? (
            <>
              <Link href="/wallet">
                <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800 hover:border-teal-500/30 transition-colors cursor-pointer">
                  <Wallet className="h-4 w-4 text-teal-500" />
                  <span className="font-mono text-sm font-semibold text-amber-400">
                    ${(wallet?.balance ?? 0).toFixed(2)}
                  </span>
                </div>
              </Link>
              <Link href="/notifications">
                <Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-white">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </Button>
              </Link>
              <UserMenu onLogout={logout} />
            </>
          ) : (
            <>
              {/* Desktop: Login + Join Now */}
              <Link href="/login" className="hidden md:inline-flex">
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">Login</Button>
              </Link>
              {/* Mobile + Desktop: Join Now */}
              <Link href="/register">
                <Button size="sm" className="bg-teal-500 text-slate-950 hover:bg-teal-400 font-semibold">
                  Join Now
                </Button>
              </Link>
              {/* Mobile only: hamburger */}
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
          {navLinks.filter(l => !l.mobileHide).map(({ href, label, pulse }) => {
            const active = location.startsWith(href);
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
