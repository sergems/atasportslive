import React from 'react';
import { Link } from 'wouter';
import { useSEO } from '@/lib/seo';
import {
  Apple, Bell, ChevronLeft, CreditCard, Download, Fingerprint,
  Layers, Play, Radio, ShieldCheck, Smartphone, Sparkles, Wallet,
} from 'lucide-react';

const SCREENS = [
  { src: '/app-screens/home.png', label: 'Home' },
  { src: '/app-screens/live.png', label: 'Live player' },
  { src: '/app-screens/wallet.png', label: 'Wallet' },
  { src: '/app-screens/subscription.png', label: 'Subscriptions' },
  { src: '/app-screens/more.png', label: 'More' },
];

const FEATURES = [
  { icon: Radio, title: 'Live, everywhere', text: 'Watch every ATA broadcast in landscape with full-screen, play/pause and mute controls built right in.' },
  { icon: Layers, title: 'Three live channels', text: 'When extra broadcasts go live, Live 2 and Live 3 appear automatically — switch between them without leaving the app.' },
  { icon: Wallet, title: 'Wallet & bonuses', text: 'Deposit by mobile money or card, redeem vouchers and bonus codes, and track every transaction.' },
  { icon: Fingerprint, title: 'Face ID unlock', text: 'Your tokens stay on your device. Unlock with Face ID or fingerprint — no passwords to remember.' },
  { icon: Bell, title: 'Never miss a moment', text: 'Get notified the moment a channel goes live, wherever you are.' },
  { icon: CreditCard, title: 'Simple subscriptions', text: 'Daily, weekly, monthly and yearly plans. Bonus balance is always spent first.' },
];

function Phone({ src, label, className = '' }: { src: string; label: string; className?: string }) {
  return (
    <div className={`group relative w-[210px] shrink-0 rounded-[2.4rem] border-[6px] border-slate-700 bg-slate-900 shadow-2xl shadow-black/60 transition-transform duration-500 hover:-translate-y-3 sm:w-[230px] ${className}`}>
      <div className="absolute left-1/2 top-1.5 z-10 h-3.5 w-16 -translate-x-1/2 rounded-full bg-slate-950" />
      <img src={src} alt={`ATA Sports Live app — ${label}`} loading="lazy" className="aspect-[402/874] w-full rounded-[1.9rem] object-cover" />
    </div>
  );
}

export default function AppLanding() {
  useSEO({
    title: 'ATA Sports Live — The Official Mobile App',
    path: '/app',
    description: "Watch live sport, manage your wallet and unlock streams on the go. Download the official ATA Sports Live app for iOS and Android.",
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top bar — deliberately separate from the main website navigation */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2">
          <img src="/ata-logo.png" alt="ATA Sports Live" className="h-9 w-auto" />
          <span className="text-sm font-semibold tracking-wide">Mobile App</span>
        </div>
        <Link href="/" className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300 transition-colors hover:border-teal-400 hover:text-white">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to website
        </Link>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-teal-500/20 blur-[120px]" />
        <div className="pointer-events-none absolute -right-32 top-20 h-[420px] w-[420px] rounded-full bg-amber-500/10 blur-[130px]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-16 pt-10 lg:grid-cols-2 lg:pt-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/10 px-4 py-1.5 text-xs font-semibold text-teal-400">
              <Sparkles className="h-3.5 w-3.5" /> ATA Sports Live · iOS &amp; Android
            </span>
            <h1 className="mt-6 text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
              Live sport.
              <br />
              <span className="bg-gradient-to-r from-teal-400 to-amber-500 bg-clip-text text-transparent">In your pocket.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400">
              The official ATA Sports Live app puts every broadcast, subscription and wallet action in one beautiful place.
              Go live in a tap, follow the action full-screen, and never miss a moment of African sport.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="/ata-live.apk" download="ata-live.apk" className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-6 py-3.5 text-sm font-bold text-slate-950 transition-colors hover:bg-teal-400">
                <Download className="h-4 w-4" /> Download for Android
              </a>
              <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-700 px-6 py-3.5 text-sm font-semibold text-slate-500">
                <Apple className="h-4 w-4" /> App Store — coming soon
              </span>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
              {[
                { icon: Radio, value: '3', label: 'Live channels' },
                { icon: Play, value: 'HD', label: 'Full-screen video' },
                { icon: ShieldCheck, value: 'Face ID', label: 'Secure unlock' },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <s.icon className="h-5 w-5 text-teal-400" />
                  <div>
                    <p className="text-sm font-bold text-white">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex justify-center">
            <div className="absolute inset-0 rounded-full bg-teal-500/10 blur-3xl" />
            <div className="relative flex translate-y-6 gap-4">
              <Phone src="/app-screens/home.png" label="Home" className="rotate-[-7deg]" />
              <Phone src="/app-screens/subscription.png" label="Subscriptions" className="z-10 translate-y-6" />
              <Phone src="/app-screens/wallet.png" label="Wallet" className="rotate-[7deg]" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-5 py-16">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-400">Built for fans</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Everything you love, designed for mobile.</h2>
          <p className="mt-4 text-slate-400">Fast, clean and made for the way you actually watch — short sessions, live moments and instant access.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-colors hover:border-teal-400/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Screens showcase */}
      <section className="border-y border-slate-800 bg-slate-900/40 py-16">
        <div className="mx-auto max-w-7xl px-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500">Take a look</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Five screens. One seamless app.</h2>
            </div>
            <p className="max-w-md text-sm text-slate-400">From the home slider to the wallet and the More menu — the whole experience, right at your fingertips.</p>
          </div>
          <div className="mt-12 flex snap-x gap-6 overflow-x-auto pb-6">
            {SCREENS.map((s) => (
              <div key={s.label} className="snap-start">
                <Phone src={s.src} label={s.label} />
                <p className="mt-4 text-center text-xs font-medium text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">Get started in minutes</h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {[
            { n: '01', title: 'Download', text: 'Install the app on your Android device, or use the same account on iOS when it launches.' },
            { n: '02', title: 'Sign in', text: 'Use your ATA Sports Live account. Enable Face ID or fingerprint for one-tap, secure unlock.' },
            { n: '03', title: 'Watch & enjoy', text: 'Open Live for the broadcast, explore More for your account, and manage funds in Wallet.' },
          ].map((step) => (
            <div key={step.n}>
              <span className="text-4xl font-extrabold text-teal-400/30">{step.n}</span>
              <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Download CTA */}
      <section className="mx-auto max-w-7xl px-5 pb-16">
        <div className="relative overflow-hidden rounded-3xl border border-teal-400/20 bg-gradient-to-br from-slate-900 via-teal-900/30 to-slate-900 px-6 py-14 text-center">
          <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="relative">
            <Smartphone className="mx-auto h-10 w-10 text-teal-400" />
            <h2 className="mt-5 text-3xl font-bold sm:text-4xl">Take ATA with you.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">Download the official app and turn every moment into a live one.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a href="/ata-live.apk" download="ata-live.apk" className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-6 py-3.5 text-sm font-bold text-slate-950 hover:bg-teal-400">
                <Download className="h-4 w-4" /> Download for Android
              </a>
              <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-700 px-6 py-3.5 text-sm font-semibold text-slate-500">
                <Apple className="h-4 w-4" /> App Store — coming soon
              </span>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
              <Link href="/app/privacy" className="hover:text-teal-400">App Privacy Policy</Link>
              <Link href="/app/terms" className="hover:text-teal-400">App Terms &amp; Conditions</Link>
              <span>Account deletion &amp; permissions included</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 py-8 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} ATA Sports Live. All rights reserved.
      </footer>
    </div>
  );
}
