import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { VideoView } from 'expo-video';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { PlayerControls } from '@/components/player-controls';
import { useControlsVisibility } from '@/hooks/use-controls-visibility';
import { useMuxPlayer } from '@/hooks/use-mux-player';
import { APP_ORIGIN } from '@/lib/api';

// react-native-webview types its ref as `unknown`; this is the handle we use.
type WebViewHandle = { injectJavaScript: (script: string) => void };

// Native video/WebView surfaces can render above later RN siblings on iOS, so
// the tap catcher and controls are explicitly layered over the player.
const tapLayer = { ...StyleSheet.absoluteFill, zIndex: 5 } as const;

type SharedProps = { title?: string; live?: boolean; showBack?: boolean; onChat?: () => void };

export function MuxPlayer({ uri, title, live = true, showBack = false, onChat }: { uri: string } & SharedProps) {
  const viewRef = useRef<VideoView | null>(null);
  const { player, isPlaying, muted, togglePlay, toggleMute } = useMuxPlayer(uri);
  const { visible, toggle } = useControlsVisibility(isPlaying);

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView
        ref={viewRef}
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="contain"
        nativeControls={false}
        fullscreenOptions={{ enable: true }}
        allowsPictureInPicture
      />
      <Pressable style={tapLayer} onPress={toggle} />
      <PlayerControls
        title={title}
        live={live}
        playing={isPlaying}
        muted={muted}
        visible={visible}
        onTogglePlay={togglePlay}
        onToggleMute={toggleMute}
        onFullscreen={() => { void viewRef.current?.enterFullscreen().catch(() => {}); }}
        onBack={showBack ? () => router.back() : undefined}
        onChat={onChat}
      />
    </View>
  );
}

export function YouTubePlayer({
  videoId,
  live,
  startAt,
  title,
  showBack = false,
  onChat,
}: { videoId: string; live: boolean; startAt: number } & SharedProps) {
  const webRef = useRef<WebViewHandle>(null);
  const lastCommand = useRef(0);
  const lastTime = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true); // embed starts with mute=1
  const { visible, toggle } = useControlsVisibility(playing);

  // YouTube requires the embedding origin + matching Referer, otherwise it
  // serves "Error 153 / Video player configuration error" inside a WebView.
  const embedUri = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1&controls=0&enablejsapi=1&origin=${encodeURIComponent(APP_ORIGIN)}${live ? '' : `&start=${Math.floor(startAt)}`}`;

  const injected = `
    window.addEventListener('message', function (e) {
      try {
        var d = JSON.parse(e.data);
        if (d && d.event === 'infoDelivery' && d.info) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            t: typeof d.info.currentTime === 'number' ? d.info.currentTime : null,
            playing: d.info.playerState === 1,
            live: d.info.isLive === true
          }));
        }
      } catch (err) {}
    });
    setInterval(function () {
      try { window.postMessage(JSON.stringify({ event: 'command', func: 'getCurrentTime', args: [] }), '*'); } catch (err) {}
    }, 2000);
    true;
  `;

  const command = useCallback((func: string) => {
    lastCommand.current = Date.now();
    webRef.current?.injectJavaScript(
      `window.postMessage(${JSON.stringify({ event: 'command', func, args: [] })}, '*'); true;`
    );
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) {
      command('pauseVideo');
      setPlaying(false);
    } else {
      command('playVideo');
      setPlaying(true);
    }
  }, [playing, command]);

  const toggleMute = useCallback(() => {
    if (muted) {
      command('unMute');
      setMuted(false);
    } else {
      command('mute');
      setMuted(true);
    }
  }, [muted, command]);

  const fullscreen = useCallback(() => {
    webRef.current?.injectJavaScript(
      `var b = document.querySelector('.ytp-fullscreen-button'); if (b) { b.click(); } true;`
    );
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        ref={(instance) => { webRef.current = instance as unknown as WebViewHandle; }}
        style={StyleSheet.absoluteFill}
        source={{ uri: embedUri, headers: { Referer: `${APP_ORIGIN}/` } }}
        injectedJavaScript={injected}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data) as { t?: number | null; playing?: boolean; live?: boolean };
            // Ignore echoes right after a local command to avoid flicker.
            if (Date.now() - lastCommand.current > 1000 && typeof data.t === 'number') {
              const previous = lastTime.current;
              const advanced = previous !== null && data.t > previous + 0.15;
              lastTime.current = data.t;
              // A moving playhead is the most reliable "playing" signal in the iframe.
              if (advanced) setPlaying(true);
              else if (data.playing === false) setPlaying(false);
            }
            if (!data.live && typeof data.t === 'number') {
              void SecureStore.setItemAsync(`ata_yt_pos_${videoId}`, String(data.t));
            }
          } catch { /* ignore */ }
        }}
      />
      <Pressable style={tapLayer} onPress={toggle} />
      <PlayerControls
        title={title}
        live={live}
        playing={playing}
        muted={muted}
        visible={visible}
        onTogglePlay={togglePlay}
        onToggleMute={toggleMute}
        onFullscreen={fullscreen}
        onBack={showBack ? () => router.back() : undefined}
        onChat={onChat}
      />
    </View>
  );
}
