import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform,
  Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/providers/auth-provider';
import { api, APP_ORIGIN, type LiveComment } from '@/lib/api';
import { colors, fontSize, radius, spacing } from '@/theme';

const MAX_COMMENTS = 100;

/** Live chat overlay for a stream. Works on free and paid streams alike. */
export function ChatPanel({
  streamId,
  visible,
  onClose,
}: {
  streamId?: number;
  visible: boolean;
  onClose: () => void;
}) {
  const { accessToken, user, authedFetch } = useAuth();
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [input, setInput] = useState('');
  const [posting, setPosting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const listRef = useRef<FlatList<LiveComment>>(null);

  useEffect(() => {
    if (!visible || !streamId) return;
    let active = true;
    api.comments(streamId)
      .then((data) => {
        if (!active) return;
        setComments((data.comments ?? []).slice(-MAX_COMMENTS));
        setLoaded(true);
      })
      .catch(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [visible, streamId]);

  useEffect(() => {
    if (!visible || !streamId) return;
    let destroyed = false;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let socket: WebSocket | undefined;
    let attempts = 0;

    const connect = () => {
      if (destroyed) return;
      const host = APP_ORIGIN.replace(/^https?:\/\//, '');
      const scheme = APP_ORIGIN.startsWith('https:') ? 'wss' : 'ws';
      const tokenParam = accessToken ? `&token=${encodeURIComponent(accessToken)}` : '';
      socket = new WebSocket(`${scheme}://${host}/ws?streamId=${streamId}${tokenParam}`);
      socket.onopen = () => { attempts = 0; };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'stream_comment' && data.comment) {
            const incoming = data.comment as LiveComment;
            setComments((prev) => prev.some((c) => c.id === incoming.id)
              ? prev
              : [...prev, incoming].slice(-MAX_COMMENTS));
          }
        } catch { /* ignore malformed frames */ }
      };
      const scheduleReconnect = () => {
        if (destroyed) return;
        attempts = Math.min(attempts + 1, 5);
        clearTimeout(reconnect);
        reconnect = setTimeout(connect, Math.min(3000 * attempts, 15000));
      };
      socket.onerror = scheduleReconnect;
      socket.onclose = scheduleReconnect;
    };

    connect();
    return () => {
      destroyed = true;
      clearTimeout(reconnect);
      socket?.close();
    };
  }, [visible, streamId, accessToken]);

  useEffect(() => {
    if (visible && comments.length) {
      const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 40);
      return () => clearTimeout(t);
    }
  }, [comments.length, visible]);

  const send = async () => {
    const content = input.trim();
    if (!content || !streamId) return;
    setPosting(true);
    try {
      const created = await authedFetch((token) => api.postComment(streamId, token, content));
      setComments((prev) => prev.some((c) => c.id === created.id)
        ? prev
        : [...prev, created].slice(-MAX_COMMENTS));
      setInput('');
    } catch (error) {
      Alert.alert('Could not post', error instanceof Error ? error.message : 'Please try again');
    } finally {
      setPosting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          style={styles.panel}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Ionicons name="chatbubbles" size={18} color={colors.primary} />
              <Text style={styles.headerText}>Live chat</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close chat">
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          {!loaded ? (
            <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <FlatList
              ref={listRef}
              data={comments}
              keyExtractor={(item) => String(item.id)}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => (
                <View style={[styles.bubble, item.userId === user?.id && styles.bubbleMine]}>
                  <Text style={styles.author}>{item.username}</Text>
                  <Text style={styles.body}>{item.content}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No messages yet. Say hello!</Text>}
            />
          )}

          <View style={styles.composer}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Say something…"
              placeholderTextColor={colors.muted}
              style={styles.input}
              maxLength={280}
              autoCapitalize="sentences"
              returnKeyType="send"
              onSubmitEditing={() => void send()}
            />
            <Pressable
              onPress={() => void send()}
              disabled={posting || !input.trim()}
              style={[styles.send, (posting || !input.trim()) && styles.sendDisabled]}
              accessibilityLabel="Send comment"
            >
              {posting
                ? <ActivityIndicator color={colors.onPrimary} size="small" />
                : <Ionicons name="send" size={18} color={colors.onPrimary} />}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.72)', justifyContent: 'flex-end' },
  panel: {
    maxHeight: '78%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText: { color: colors.text, fontSize: fontSize.md, fontWeight: '800' },
  loading: { height: 160, alignItems: 'center', justifyContent: 'center' },
  list: { maxHeight: 380 },
  listContent: { padding: spacing.md, gap: spacing.sm },
  bubble: {
    alignSelf: 'flex-start', maxWidth: '86%',
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    paddingHorizontal: spacing.sm, paddingVertical: 8,
  },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#0F3D3A' },
  author: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '800', marginBottom: 2 },
  body: { color: colors.text, fontSize: fontSize.sm, lineHeight: 19 },
  empty: { color: colors.muted, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: 24 },
  composer: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, color: colors.text, backgroundColor: colors.background,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: fontSize.sm,
  },
  send: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary,
  },
  sendDisabled: { opacity: 0.45 },
});
