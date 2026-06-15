import React from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard,
  Radio,
  Trophy,
  Users,
  Wallet,
  BarChart2,
  Ticket,
} from 'lucide-react';

const navItems = [
  { href: '/admin',           label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/streams',   label: 'Streams',   icon: Radio },
  { href: '/admin/games',     label: 'Games',     icon: Trophy },
  { href: '/admin/users',     label: 'Users',     icon: Users },
  { href: '/admin/wallets',   label: 'Wallets',   icon: Wallet },
  { href: '/admin/vouchers',  label: 'Vouchers',  icon: Ticket },
  { href: '/admin/reports',   label: 'Reports',   icon: BarChart2 },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const isActive = (href: string, exact?: boolean) =>
    exact ? location === href : location.startsWith(href);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] -mx-4 md:-mx-6 lg:-mx-8">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-slate-800 bg-slate-900/60 flex flex-col pt-6 pb-8 px-3">
        <div className="mb-6 px-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Admin Panel</span>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link key={href} href={href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer
                    ${active
                      ? 'bg-teal-500/15 text-teal-400 border border-teal-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-teal-400' : ''}`} />
                  {label}
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto px-6 py-6">
        {children}
      </main>
    </div>
  );
}
