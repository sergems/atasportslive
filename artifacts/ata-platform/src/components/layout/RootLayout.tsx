import React from 'react';
import { Navbar } from './Navbar';
import { useWebSocket } from '@/hooks/use-websocket';

export function RootLayout({ children }: { children: React.ReactNode }) {
  useWebSocket();
  
  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
