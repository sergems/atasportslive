import React from 'react';
import { Link } from 'wouter';
import { Navbar } from './Navbar';
import { useWebSocket } from '@/hooks/use-websocket';
import { MapPin, Phone, Mail } from 'lucide-react';

export function RootLayout({ children }: { children: React.ReactNode }) {
  useWebSocket();

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="mt-16 border-t border-border/40 bg-primary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Brand */}
            <div>
              <Link href="/" className="flex items-center space-x-2 mb-4">
                <div className="h-7 w-7 rounded-md bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shrink-0">
                  <span className="text-slate-950 font-black text-xs">ATA</span>
                </div>
                <span className="font-bold text-base text-white tracking-tight">Advanced Talent Agency</span>
              </Link>
              <p className="text-sm text-slate-400 leading-relaxed">
                Kampala's premier sports streaming and P2P betting exchange. Watch live Pool and Boxing. Bet in real-time.
              </p>
              <p className="mt-3 text-xs text-slate-500">
                &copy; {new Date().getFullYear()} ATA Sports Live. All rights reserved.
              </p>
            </div>

            {/* General Contact */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">General Contact</h3>
              <ul className="space-y-3 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-teal-500 mt-0.5 shrink-0" />
                  <span>Nsambya, Kampala, Uganda</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-teal-500 shrink-0" />
                  <a href="tel:+256772364513" className="hover:text-teal-400 transition-colors">+256 772 364 513</a>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-teal-500 shrink-0" />
                  <a href="tel:+256756517675" className="hover:text-teal-400 transition-colors">+256 756 517 675</a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-teal-500 shrink-0" />
                  <a href="mailto:info@atasportslive.com" className="hover:text-teal-400 transition-colors">info@atasportslive.com</a>
                </li>
              </ul>
            </div>

            {/* Account Opening */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Account Opening</h3>
              <ul className="space-y-3 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-amber-500 shrink-0" />
                  <a href="tel:+256788663317" className="hover:text-amber-400 transition-colors">+256 788 663 317</a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-amber-500 shrink-0" />
                  <a href="mailto:paul@atasportslive.com" className="hover:text-amber-400 transition-colors">paul@atasportslive.com</a>
                </li>
              </ul>
              <div className="mt-6 pt-4 border-t border-slate-800">
                <div className="flex gap-4 text-xs text-slate-500">
                  <a href="https://atasportslive.com/" className="hover:text-slate-300 transition-colors">atasportslive.com</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
