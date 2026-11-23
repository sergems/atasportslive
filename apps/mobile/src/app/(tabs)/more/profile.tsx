import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, PrimaryButton, Screen, ScreenHeader, SectionTitle, TextField } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { api, APP_ORIGIN } from '@/lib/api';
import { isBiometricEnabled, promptBiometrics } from '@/lib/secure-storage';
import { colors, fontSize, radius, spacing } from '@/theme';

const ID_TYPES = ['National ID', 'Passport', "Driver's License", 'Refugee ID', 'Military ID'];
const COUNTRIES = ['Uganda', 'Kenya', 'Tanzania', 'Rwanda', 'South Sudan', 'DR Congo', 'Nigeria', 'Ghana', 'South Africa', 'Zambia', 'Other'];

export default function ProfileScreen() {
  const { user, refreshUser, authedFetch, signOut, biometricAvailable, setBiometricProtection } = useAuth();
  const [editingFica, setEditingFica] = useState(!user?.ficaCompleted);
  const [fica, setFica] = useState({
    fullName: user?.fullName ?? '', surname: user?.surname ?? '', phone: user?.phone ?? '',
    dateOfBirth: user?.dateOfBirth ?? '', idType: user?.idType ?? ID_TYPES[0],
    idNumber: user?.idNumber ?? '', country: user?.country ?? 'Uganda',
  });
  const [editingInfo, setEditingInfo] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [biometrics, setBiometrics] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => { isBiometricEnabled().then(setBiometrics); }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); }
    catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not save'); }
    finally { setBusy(false); }
  };

  const saveFica = () => run(async () => {
    const updated = await authedFetch((t) => api.updateFica(t, fica));
    refreshUser(updated); setEditingFica(false);
    Alert.alert('Saved', 'Your verification details have been updated.');
  });

  const saveInfo = () => run(async () => {
    const updated = await authedFetch((t) => api.updateProfile(t, { fullName, phone }));
    refreshUser(updated); setEditingInfo(false);
    Alert.alert('Saved', 'Your personal information has been updated.');
  });

  const saveUsername = () => run(async () => {
    const updated = await authedFetch((t) => api.updateProfile(t, { fullName: user?.fullName ?? 'ATA user', phone: phone || undefined, username: username.toLowerCase() }));
    refreshUser(updated);
    Alert.alert('Username saved', 'Your username cannot be changed again.');
  });

  const changePassword = () => run(async () => {
    await authedFetch((t) => api.changePassword(t, passwords.current, passwords.next));
    setPasswords({ current: '', next: '' });
    Alert.alert('Password updated', 'You can now sign in with your new password.');
  });

  const confirmDelete = () => run(async () => {
    await authedFetch((t) => api.deleteAccount(t, 'DELETE'));
    setDeleteStep(0);
    await signOut();
    Alert.alert('Account deleted', 'Your account and personal data have been removed.');
  });

  const toggleBiometrics = async () => {
    try {
      const next = !biometrics;
      if (next && !(await promptBiometrics())) { Alert.alert('Cancelled', 'Biometric check was cancelled'); return; }
      await setBiometricProtection(next); setBiometrics(next);
      Alert.alert('Saved', next ? 'Biometric unlock enabled' : 'Biometric unlock disabled');
    } catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Could not change setting'); }
  };

  const referral = user?.referralCode ? `${APP_ORIGIN}/register?ref=${user.referralCode}` : '';

  return (
    <Screen>
      <ScreenHeader title="Profile" />
      <SectionTitle>Profile Settings</SectionTitle>

      {/* FICA */}
      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Identity verification</Text>
          <View style={[styles.pill, user?.ficaCompleted ? styles.pillGood : styles.pillWarn]}>
            <Text style={styles.pillText}>{user?.ficaCompleted ? '✓ VERIFIED' : 'INCOMPLETE'}</Text>
          </View>
        </View>
        <Text style={styles.hint}>
          {user?.ficaCompleted
            ? 'Your identity is verified. You can withdraw funds.'
            : 'Complete verification to unlock withdrawals. Your details are encrypted and never shared.'}
        </Text>

        {editingFica ? (
          <View style={styles.form}>
            <TextField label="First name *" value={fica.fullName} onChangeText={(v) => setFica({ ...fica, fullName: v })} autoCapitalize="words" />
            <TextField label="Surname *" value={fica.surname} onChangeText={(v) => setFica({ ...fica, surname: v })} autoCapitalize="words" />
            <TextField label="Phone *" value={fica.phone} onChangeText={(v) => setFica({ ...fica, phone: v })} keyboardType="phone-pad" placeholder="+256..." />
            <TextField label="Date of birth *" value={fica.dateOfBirth} onChangeText={(v) => setFica({ ...fica, dateOfBirth: v })} placeholder="YYYY-MM-DD" />
            <TextField label="ID type *" value={fica.idType} onChangeText={() => {}} />
            <Pressable style={styles.chipRow} onPress={() => {
              const i = ID_TYPES.indexOf(fica.idType);
              setFica({ ...fica, idType: ID_TYPES[(i + 1) % ID_TYPES.length] });
            }}><Text style={styles.chipHint}>Tap to change ID type: {fica.idType}</Text></Pressable>
            <TextField label="ID number *" value={fica.idNumber} onChangeText={(v) => setFica({ ...fica, idNumber: v })} autoCapitalize="characters" />
            <Pressable style={styles.chipRow} onPress={() => {
              const i = COUNTRIES.indexOf(fica.country);
              setFica({ ...fica, country: COUNTRIES[(i + 1) % COUNTRIES.length] });
            }}><Text style={styles.chipHint}>Country: {fica.country} (tap to change)</Text></Pressable>
            <PrimaryButton title={busy ? 'Saving…' : (user?.ficaCompleted ? 'Update info' : 'Complete verification')} onPress={saveFica} disabled={busy} />
          </View>
        ) : (
          <>
            <InfoRow label="Name" value={`${fica.fullName} ${fica.surname}`.trim()} />
            <InfoRow label="Phone" value={fica.phone} />
            <InfoRow label="ID" value={`${fica.idType} · ${fica.idNumber}`} />
            <InfoRow label="Country" value={fica.country} />
            <Pressable onPress={() => setEditingFica(true)}><Text style={styles.link}>Edit verification info →</Text></Pressable>
          </>
        )}
      </Card>

      {/* Refer & earn */}
      {!!referral && (
        <Card>
          <Text style={styles.cardTitle}>{user?.isInfluencer ? 'Influencer dashboard' : 'Refer & earn'}</Text>
          <Text style={styles.hint}>
            {user?.isInfluencer
              ? 'Earn commission when people you refer subscribe.'
              : 'Earn a 5% bonus when a referred user buys their first stream.'}
          </Text>
          <InfoRow label="Your code" value={user?.referralCode ?? ''} />
          <Text style={styles.referralLink} selectable>{referral}</Text>
        </Card>
      )}

      {/* Personal info */}
      <Card>
        <View style={styles.cardHead}><Text style={styles.cardTitle}>Personal info</Text>
          {!editingInfo && <Pressable onPress={() => setEditingInfo(true)}><Text style={styles.link}>Edit</Text></Pressable>}
        </View>
        {editingInfo ? (
          <View style={styles.form}>
            <TextField label="Display name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
            <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <PrimaryButton title="Save" onPress={saveInfo} disabled={busy} />
          </View>
        ) : (
          <>
            <InfoRow label="Name" value={user?.fullName ?? '—'} />
            <InfoRow label="Email" value={user?.email ?? '—'} />
            <InfoRow label="Phone" value={user?.phone ?? '—'} />
          </>
        )}
      </Card>

      {/* Username */}
      <Card>
        <Text style={styles.cardTitle}>Username</Text>
        <Text style={styles.hint}>@{user?.username ?? '—'}</Text>
        {(user?.usernameChangesCount ?? 0) < 1 ? (
          <View style={styles.form}>
            <TextField label="Choose a username" value={username} onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="yourname" maxLength={20} />
            <PrimaryButton title="Save username (permanent)" onPress={saveUsername} disabled={!username || busy} />
          </View>
        ) : <Text style={styles.hint}>Your username can only be changed once.</Text>}
      </Card>

      {/* Sign-in methods */}
      <Card>
        <Text style={styles.cardTitle}>Sign-in methods</Text>
        <InfoRow label="Email & password" value={user?.hasPassword ? 'Active' : 'Not set'} />
        <View style={styles.form}>
          {user?.hasPassword && <TextField label="Current password" value={passwords.current} onChangeText={(v) => setPasswords({ ...passwords, current: v })} secureTextEntry />}
          <TextField label="New password (min 6 characters)" value={passwords.next} onChangeText={(v) => setPasswords({ ...passwords, next: v })} secureTextEntry />
          <PrimaryButton title="Change password" onPress={changePassword} disabled={passwords.next.length < 6 || (user?.hasPassword && !passwords.current) || busy} />
        </View>
        <InfoRow label="Google" value={user?.googleLinked ? 'Linked' : 'Not linked'} />
      </Card>

      {/* Security */}
      <Card>
        <Text style={styles.cardTitle}>Security</Text>
        <Pressable onPress={biometricAvailable ? toggleBiometrics : undefined} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Face ID / Fingerprint</Text>
            <Text style={styles.hint}>{biometricAvailable ? 'Require biometric unlock on launch' : 'Not available on this device'}</Text>
          </View>
          <View style={[styles.switch, biometrics && styles.switchOn]}><View style={[styles.knob, biometrics && styles.knobOn]} /></View>
        </Pressable>
      </Card>

      <Pressable onPress={() => router.push('/(tabs)/more/subscription')}><Text style={styles.link}>Manage subscription →</Text></Pressable>

      {/* Last option: account deletion */}
      <Card style={styles.dangerCard}>
        <Text style={styles.cardTitle}>Delete account</Text>
        <Text style={styles.hint}>Permanently remove your profile, wallet, access and personal data. This cannot be undone.</Text>
        <Pressable style={styles.deleteButton} onPress={() => { setDeleteConfirm(''); setDeleteStep(1); }}>
          <Text style={styles.deleteButtonText}>Delete account</Text>
        </Pressable>
      </Card>

      {busy && <ActivityIndicator color={colors.primary} />}

      <Modal visible={deleteStep > 0} transparent animationType="fade" onRequestClose={() => setDeleteStep(0)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView>
              {deleteStep === 1 ? (
                <>
                  <Text style={styles.modalTitle}>Delete your account?</Text>
                  <Text style={styles.hint}>
                    Your profile, wallet, stream access, bonuses and activity will be removed. Your identity details are erased; only legally required financial and audit records may be kept, without personal information.
                  </Text>
                  <Text style={styles.hint}>Nothing happens until you confirm on the next screen.</Text>
                  <Pressable style={styles.modalSecondary} onPress={() => setDeleteStep(0)}>
                    <Text style={styles.modalSecondaryText}>Keep my account</Text>
                  </Pressable>
                  <Pressable style={styles.modalPrimary} onPress={() => setDeleteStep(2)}>
                    <Text style={styles.modalPrimaryText}>Continue</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.modalTitle}>Last chance to rethink</Text>
                  <Text style={styles.hint}>Type DELETE exactly to confirm. You can still go back.</Text>
                  <TextField label="Type DELETE" value={deleteConfirm} onChangeText={setDeleteConfirm} autoCapitalize="characters" placeholder="DELETE" />
                  <Pressable style={styles.modalSecondary} onPress={() => setDeleteStep(1)}>
                    <Text style={styles.modalSecondaryText}>Go back</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.deleteButton, (deleteConfirm !== 'DELETE' || busy) && styles.buttonDisabled]}
                    onPress={confirmDelete}
                    disabled={deleteConfirm !== 'DELETE' || busy}
                  >
                    <Text style={styles.deleteButtonText}>{busy ? 'Deleting…' : 'Delete my account'}</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  pill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  pillGood: { backgroundColor: '#064E3B' }, pillWarn: { backgroundColor: '#78350F' },
  pillText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: fontSize.sm, lineHeight: 18 },
  form: { gap: spacing.sm },
  chipRow: { paddingVertical: 4 },
  chipHint: { color: colors.primary, fontSize: fontSize.sm },
  link: { color: colors.primary, fontWeight: '700', fontSize: fontSize.sm },
  referralLink: { color: colors.primary, fontSize: fontSize.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 4 },
  infoLabel: { color: colors.muted, fontSize: fontSize.sm },
  infoValue: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600', flex: 1, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  rowText: { flex: 1 },
  rowTitle: { color: colors.text, fontWeight: '700' },
  switch: { width: 44, height: 25, borderRadius: radius.pill, backgroundColor: colors.border, padding: 3 },
  switchOn: { backgroundColor: colors.primary },
  knob: { width: 19, height: 19, borderRadius: radius.pill, backgroundColor: colors.muted },
  knobOn: { backgroundColor: colors.white, transform: [{ translateX: 19 }] },
  dangerCard: { borderColor: colors.danger, gap: spacing.sm },
  deleteButton: { backgroundColor: '#7F1D1D', borderRadius: radius.sm, padding: spacing.md, alignItems: 'center' },
  deleteButtonText: { color: colors.white, fontWeight: '800' },
  buttonDisabled: { opacity: 0.5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm, maxHeight: '80%' },
  modalTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  modalSecondary: { padding: spacing.md, alignItems: 'center', borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  modalSecondaryText: { color: colors.text, fontWeight: '700' },
  modalPrimary: { padding: spacing.md, alignItems: 'center', borderRadius: radius.sm, backgroundColor: colors.primary },
  modalPrimaryText: { color: colors.onPrimary, fontWeight: '800' },
});
