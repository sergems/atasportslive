import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Clapperboard } from 'lucide-react';

interface Highlight {
  id: number;
  title: string;
  description: string;
  youtubeUrl: string;
  isPublished: boolean;
  createdAt: string;
}

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1].split('?')[0];
      return u.searchParams.get('v');
    }
  } catch {
    const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
  }
  return null;
}

function HighlightCard({ h }: { h: Highlight }) {
  const [playing, setPlaying] = useState(false);
  const videoId = extractYoutubeId(h.youtubeUrl);
  const thumb = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden hover:border-teal-500/30 transition-all">
      {/* Video embed area */}
      <div className="relative aspect-video bg-black">
        {playing && videoId ? (
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title={h.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="absolute inset-0 w-full h-full group flex items-center justify-center"
          >
            {thumb ? (
              <img src={thumb} alt={h.title} className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity" />
            ) : (
              <div className="absolute inset-0 bg-slate-800" />
            )}
            <div className="relative z-10 flex items-center justify-center w-14 h-14 rounded-full bg-red-600 group-hover:bg-red-500 transition-colors shadow-xl">
              <Play className="h-6 w-6 text-white fill-white ml-1" />
            </div>
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-white font-semibold text-sm leading-snug">{h.title}</h3>
        {h.description && (
          <p className="text-slate-400 text-xs mt-1.5 line-clamp-3">{h.description}</p>
        )}
        <p className="text-slate-600 text-[10px] font-mono mt-3">
          {new Date(h.createdAt).toLocaleDateString('en-UG', { year: 'numeric', month: 'short', day: 'numeric' })}
        </p>
      </div>
    </div>
  );
}

export default function Highlights() {
  useEffect(() => { document.title = 'Highlights - ATA Platform'; }, []);

  const { data: highlights, isLoading } = useQuery<Highlight[]>({
    queryKey: ['highlights'],
    queryFn: () => fetch('/api/highlights').then((r) => r.json()),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Clapperboard className="h-6 w-6 text-amber-400" /> Highlights
        </h1>
        <p className="text-slate-400 text-sm mt-1">Match highlights and recap videos</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden">
              <Skeleton className="aspect-video w-full bg-slate-800" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4 bg-slate-800" />
                <Skeleton className="h-3 w-full bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      ) : !highlights?.length ? (
        <div className="py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
          No highlights posted yet. Check back after the next match!
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {highlights.map((h) => <HighlightCard key={h.id} h={h} />)}
        </div>
      )}
    </div>
  );
}
