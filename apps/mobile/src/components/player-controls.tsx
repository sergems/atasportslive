import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, spacing } from '@/theme';

export type PlayerControlsProps = {
  title?: string;
  live?: boolean;
  playing: boolean;
  muted: boolean;
  visible: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onFullscreen: () => void;
  onBack?: () => void;
  onChat?: () => void;
};

/** Shared, auto-hiding control surface drawn on top of the live video. */
export function PlayerControls({
  title,
  live,
  playing,
  muted,
  visible,
  onTogglePlay,
  onToggleMute,
  onFullscreen,
  onBack,
  onChat,
}: PlayerControlsProps) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} pointerEvents="box-none">
      {visible && (
        <>
          <View style={styles.topBar} pointerEvents="box-none">
            {onBack && (
              <Pressable onPress={onBack} style={styles.roundButton} hitSlop={8} accessibilityLabel="Go back">
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
              </Pressable>
            )}
            <View style={styles.heading}>
              {live && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
              {!!title && <Text style={styles.title} numberOfLines={1}>{title}</Text>}
            </View>
          </View>

          {!playing && (
            <Pressable
              onPress={onTogglePlay}
              style={styles.centerPlay}
              accessibilityLabel="Play video"
            >
              <Ionicons name="play" size={38} color="#FFFFFF" />
            </Pressable>
          )}

          <View style={styles.bottomBar} pointerEvents="box-none">
            <Pressable
              onPress={onTogglePlay}
              style={styles.roundButton}
              hitSlop={8}
              accessibilityLabel={playing ? 'Pause video' : 'Play video'}
            >
              <Ionicons name={playing ? 'pause' : 'play'} size={24} color="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={onToggleMute}
              style={styles.roundButton}
              hitSlop={8}
              accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
            >
              <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={24} color="#FFFFFF" />
            </Pressable>
            <View style={styles.spacer} />
            {onChat && (
              <Pressable
                onPress={onChat}
                style={styles.roundButton}
                hitSlop={8}
                accessibilityLabel="Open live chat"
              >
                <Ionicons name="chatbubbles-outline" size={22} color="#FFFFFF" />
              </Pressable>
            )}
            <Pressable
              onPress={onFullscreen}
              style={styles.roundButton}
              hitSlop={8}
              accessibilityLabel="Toggle fullscreen"
            >
              <Ionicons name="expand" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: 10 },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: spacing.md + 6, paddingBottom: spacing.xl,
    backgroundColor: 'rgba(3, 7, 18, 0.66)',
  },
  heading: { flex: 1, gap: 4 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5,
    backgroundColor: '#B91C1C', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  liveText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: '#FFFFFF', fontSize: fontSize.md, fontWeight: '700' },
  centerPlay: {
    position: 'absolute', alignSelf: 'center', top: '50%', marginTop: -34,
    width: 68, height: 68, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)', borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    // Extra bottom padding keeps the controls clear of the native tab bar in landscape.
    paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: 56 + spacing.sm,
    backgroundColor: 'rgba(3, 7, 18, 0.66)',
  },
  roundButton: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  spacer: { flex: 1 },
});
