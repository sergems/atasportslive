import React from 'react';
import { Link } from 'wouter';
import { Navbar } from './Navbar';
import { useWebSocket } from '@/hooks/use-websocket';
import { MapPin, Phone, Mail } from 'lucide-react';
import { FaFacebook, FaYoutube, FaInstagram } from 'react-icons/fa';
import { FaXTwitter, FaTiktok } from 'react-icons/fa6';
import ataLogo from '@assets/ATA_logo_1781543559550.png';

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            {/* Brand */}
            <div>
              <p className="text-sm text-slate-400 leading-relaxed">
                ATA produces, and promotes sporting events in Africa. We bring live sporting events to our sports' fans. We are one of Africa's largest online streaming providers of sports programming; streaming virtually every major sports event on the continent.
              </p>
              <p className="mt-3 text-xs text-slate-500">
                &copy; {new Date().getFullYear()} ATA Sports Live. All rights reserved.
              </p>
              <div className="flex items-center gap-3 mt-4">
                <a
                  href="https://www.facebook.com/profile.php?id=61567116955397"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="ATA on Facebook"
                  className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-800 text-slate-400 hover:bg-blue-600 hover:text-white transition-all duration-200"
                >
                  <FaFacebook className="h-4 w-4" />
                </a>
                <a
                  href="https://www.youtube.com/channel/UCCMb9rG7jg6g8ClKR-yBYWQ"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="ATA on YouTube"
                  className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-800 text-slate-400 hover:bg-red-600 hover:text-white transition-all duration-200"
                >
                  <FaYoutube className="h-4 w-4" />
                </a>
              </div>
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
            {/* Join the Community */}
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Join the Community</h3>

              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Uganda Boxing Champions League</p>
              <div className="flex items-center gap-2 mb-4">
                <a
                  href="https://www.instagram.com/ugandaboxingchampionsleague/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="UBCL on Instagram"
                  className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-800 text-slate-400 hover:bg-pink-600 hover:text-white transition-all duration-200"
                >
                  <FaInstagram className="h-4 w-4" />
                </a>
                <a
                  href="https://x.com/UBCL_Boxing"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="UBCL on X"
                  className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-800 text-slate-400 hover:bg-black hover:text-white transition-all duration-200"
                >
                  <FaXTwitter className="h-4 w-4" />
                </a>
              </div>

              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Uganda Boxing Federation</p>
              <div className="flex items-center gap-2">
                <a
                  href="https://x.com/BoxingUganda"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Uganda Boxing Federation on X"
                  className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-800 text-slate-400 hover:bg-black hover:text-white transition-all duration-200"
                >
                  <FaXTwitter className="h-4 w-4" />
                </a>
                <a
                  href="https://www.instagram.com/ugandaboxingfederation/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Uganda Boxing Federation on Instagram"
                  className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-800 text-slate-400 hover:bg-pink-600 hover:text-white transition-all duration-200"
                >
                  <FaInstagram className="h-4 w-4" />
                </a>
                <a
                  href="https://www.tiktok.com/@boxinguganda"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Uganda Boxing Federation on TikTok"
                  className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-600 hover:text-white transition-all duration-200"
                >
                  <FaTiktok className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Policy Links */}
          <div className="mt-10 pt-6 border-t border-slate-800 flex flex-wrap gap-x-6 gap-y-2 justify-center text-xs text-slate-500">
            <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms and Conditions</Link>
            <Link href="/privacy-policy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link href="/refund-policy" className="hover:text-slate-300 transition-colors">Refund Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
