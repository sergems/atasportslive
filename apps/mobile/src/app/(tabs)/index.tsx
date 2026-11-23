import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StreamCard } from '@/components/stream-card';
import { Card } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useChannelStatus } from '@/hooks/use-channel-status';
import { api, resolveAssetUrl } from '@/lib/api';
import { colors, fontSize, radius, spacing } from '@/theme';

export default function HomeScreen() {
  const { user } = useAuth();
  const { ch1Live } = useChannelStatus();
  const { width } = useWindowDimensions();
  const sliderRef = useRef<ScrollViewInstance>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  const { data: slides = [] } = useQuery({ queryKey: ['slides'], queryFn: () => api.slides(), staleTime: 60_000 });
  const { data: upcoming, isLoading } = useQuery({ queryKey: ['upcoming'], queryFn: () => api.upcoming(), staleTime: 30_000 });

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => {
      setSlideIndex((i) => {
        const next = (i + 1) % slides.length;
        sliderRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length, width]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <Image source={require('../../../assets/icon.png')} style={styles.logo} contentFit="contain" />
        <View style={styles.headerText}>
          <Text style={styles.hello}>Welcome back,</Text>
          <Text style={styles.name}>{user?.fullName?.split(' ')[0] ?? 'Fan'}</Text>
        </View>
      </View>

      {slides.length > 0 && (
        <View style={styles.sliderWrap}>
          <ScrollView
            ref={sliderRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setSlideIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {slides.map((s) => (
              <View key={s.id} style={[styles.slide, { width }]}>
                <Image source={resolveAssetUrl(s.imageUrl) ? { uri: resolveAssetUrl(s.imageUrl)! } : undefined} style={styles.slideImage} contentFit="cover" />
                <View style={styles.slideShade} />
                <View style={styles.slideCopy}>
                  <Text style={styles.slideTitle}>{s.title}</Text>
                  {!!s.subtitle && <Text style={styles.slideSub} numberOfLines={2}>{s.subtitle}</Text>}
                  {!!s.buttonText && (
                    <Pressable
                      style={styles.slideButton}
                      onPress={() => {
                        if (s.buttonUrl?.startsWith('http')) void Linking.openURL(s.buttonUrl);
                        else router.push('/live');
                      }}
                    >
                      <Text style={styles.slideButtonText}>{s.buttonText}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={styles.slideCounter}>
            <Text style={styles.slideCounterText}>{slideIndex + 1} / {slides.length}</Text>
          </View>
        </View>
      )}

      <Pressable style={[styles.cta, ch1Live && styles.ctaLive]} onPress={() => router.push('/live')}>
        <Text style={styles.ctaTitle}>{ch1Live ? '● WATCH LIVE NOW' : 'Watch live sport'}</Text>
        <Text style={styles.ctaSub}>Pool, boxing and more — streamed straight to your phone.</Text>
      </Pressable>

      <Text style={styles.section}>Upcoming events</Text>
      {isLoading ? (
        <Card><ActivityIndicator color={colors.primary} /></Card>
      ) : (upcoming?.length ?? 0) === 0 ? (
        <Card><Text style={styles.empty}>No upcoming events at the moment.</Text></Card>
      ) : (
        upcoming!.slice(0, 6).map((s) => <StreamCard key={s.id} stream={s} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 58, height: 58 },
  headerText: { gap: 2 },
  hello: { color: colors.muted, fontSize: fontSize.sm },
  name: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  sliderWrap: { marginHorizontal: -spacing.lg },
  slide: { height: 200, borderRadius: 0, overflow: 'hidden', backgroundColor: colors.surface },
  slideImage: { ...StyleSheet.absoluteFill },
  slideShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,12,22,0.62)' },
  slideCopy: { flex: 1, justifyContent: 'flex-end', padding: spacing.lg, gap: spacing.xs },
  slideTitle: { color: colors.white, fontSize: fontSize.lg, fontWeight: '800' },
  slideSub: { color: '#CBD5E1', fontSize: fontSize.sm },
  slideButton: { alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.xs },
  slideButtonText: { color: colors.onPrimary, fontWeight: '800', fontSize: fontSize.sm },
  slideCounter: {
    position: 'absolute', bottom: spacing.sm, right: spacing.lg,
    backgroundColor: 'rgba(3, 7, 18, 0.72)', borderRadius: radius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  slideCounterText: { color: colors.white, fontSize: fontSize.xs, fontWeight: '700' },
  cta: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, borderCurve: 'continuous' },
  ctaLive: { backgroundColor: '#450A0A', borderColor: colors.danger },
  ctaTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  ctaSub: { color: colors.muted, fontSize: fontSize.sm, marginTop: 4 },
  section: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700', marginTop: spacing.sm },
  empty: { color: colors.muted, fontSize: fontSize.sm },
});
