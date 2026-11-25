import { useCallback } from 'react';
import { useEvent } from 'expo';
import { useVideoPlayer, type VideoSource } from 'expo-video';

/** Owns the expo-video instance and exposes imperative, immutable controls. */
export function useCloudflarePlayer(uri: string) {
  const source: VideoSource = { uri, contentType: 'hls' };
  const player = useVideoPlayer(source, (p) => {
    p.muted = true; // required for reliable autoplay; the overlay can unmute
    p.play();
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted });

  const togglePlay = useCallback(() => {
    if (player.playing) player.pause();
    else player.play();
  }, [player]);

  const toggleMute = useCallback(() => {
    // expo-video controls audio by mutating the player instance by design.
    // eslint-disable-next-line react-hooks/immutability
    player.muted = !player.muted;
  }, [player]);

  return { player, isPlaying, muted, togglePlay, toggleMute };
}
