import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useListStreams } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Streams() {
  const [status, setStatus] = useState<string>('all');
  
  useEffect(() => {
    document.title = 'Streams - ATA Platform';
  }, []);

  const { data: streamsData, isLoading } = useListStreams({
    status: status !== 'all' ? status : undefined,
    limit: 20
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Live Streams</h1>
          <p className="text-slate-400 mt-1">Watch premium African sports action</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px] bg-slate-900 border-slate-800 text-white">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white">
              <SelectItem value="all">All Streams</SelectItem>
              <SelectItem value="live">Live Now</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl bg-slate-800" />)
        ) : streamsData?.streams.length ? (
          streamsData.streams.map(stream => (
            <Link key={stream.id} href={`/streams/${stream.id}`}>
              <Card className="group overflow-hidden border-primary/20 bg-card hover:border-teal-500/50 transition-all duration-300 cursor-pointer h-full flex flex-col">
                <div className="relative aspect-video bg-slate-900">
                  {stream.thumbnailUrl ? (
                    <img src={stream.thumbnailUrl} alt={stream.title} className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800">
                      <Play className="h-12 w-12 text-slate-600" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    {stream.status === 'live' ? (
                      <span className="inline-flex items-center rounded-md bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-500 ring-1 ring-inset ring-red-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse"></span>
                        LIVE
                      </span>
                    ) : stream.status === 'upcoming' ? (
                      <span className="inline-flex items-center rounded-md bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-400 ring-1 ring-inset ring-teal-500/20">
                        UPCOMING
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-slate-500/10 px-2.5 py-1 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-500/20">
                        ENDED
                      </span>
                    )}
                  </div>
                </div>
                <CardContent className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{stream.sport}</span>
                      {stream.accessPrice ? (
                        <span className="text-sm font-medium text-amber-400">${stream.accessPrice.toFixed(2)}</span>
                      ) : (
                        <span className="text-sm font-medium text-teal-400">FREE</span>
                      )}
                    </div>
                    <h3 className="font-bold text-lg text-white group-hover:text-teal-300 transition-colors line-clamp-2">{stream.title}</h3>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500 font-mono">
                    <span>{new Date(stream.startTime).toLocaleDateString()}</span>
                    <span>{stream.viewerCount || 0} viewers</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <div className="col-span-full py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No streams found matching the criteria.
          </div>
        )}
      </div>
    </div>
  );
}
