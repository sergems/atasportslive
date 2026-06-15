import React from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Bell, User as UserIcon, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useListNotifications, useGetWallet } from '@workspace/api-client-react';
import ataLogo from '@assets/ATA_logo_1781543559550.png';

export function Navbar() {
  const { isAuthenticated, user, logout, isAdmin } = useAuth();
  const [location] = useLocation();

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
    { href: '/streams', label: 'Streams' },
    { href: '/games', label: 'Games' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-7xl mx-auto px-4 items-center">
        <div className="mr-4 flex items-center">
          <Link href="/" className="mr-8 flex items-center">
            <img src={ataLogo} alt="ATA" className="h-12 w-12 object-contain" />
          </Link>
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`transition-colors hover:text-white ${location.startsWith(href) ? 'text-white' : 'text-slate-400'}`}
              >
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
        </div>

        <div className="ml-auto flex items-center space-x-2">
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
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                  <UserIcon className="h-5 w-5" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="hidden md:flex text-slate-500 hover:text-slate-300 text-xs"
              >
                Sign Out
              </Button>
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
            </>
          )}
        </div>
      </div>
    </header>
  );
}
