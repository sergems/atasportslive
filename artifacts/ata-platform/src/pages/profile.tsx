import React, { useState } from 'react';
import { useSEO } from '@/lib/seo';
import { useAuth } from '@/lib/auth';
import { useGoogleAuth } from '@/lib/google-auth';
import { GoogleLogin } from '@react-oauth/google';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  CheckCircle, Mail, Phone, User, Link2, Unlink, KeyRound, Gift, Copy, Check,
  AtSign, Lock, ShieldCheck, ShieldAlert, Calendar, CreditCard, Globe, Camera, Loader2, Star, DollarSign, Users,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';

function InfluencerDashboard({ referralCode }: { referralCode: string | null }) {
  const token = useAuthStore((s) => s.token);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['influencer-my-referrals'],
    queryFn: async () => {
      const res = await fetch('/api/influencers/my-referrals', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load referral data');
      return res.json() as Promise<{
        referrals: Array<{ id: number; fullName: string; username: string | null; joinedAt: string }>;
        totalReferrals: number;
        totalCommissionEarned: number;
      }>;
    },
    enabled: !!token,
  });

  const SITE_ORIGIN = 'https://atasportslive.com';
  const referralLink = referralCode ? `${SITE_ORIGIN}/register?ref=${referralCode}` : null;

  const handleCopy = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-amber-500/20">
      <CardHeader>
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-400" /> Influencer Dashboard
        </CardTitle>
        <CardDescription>
          You're an influencer! Share your link — earn a commission directly to your main wallet every time someone you referred buys a subscription.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2.5 flex items-center gap-2">
            <Users className="h-4 w-4 text-teal-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Referrals</p>
              <p className="text-lg font-bold text-white font-mono">
                {isLoading ? '…' : (data?.totalReferrals ?? 0)}
              </p>
            </div>
          </div>
          <div className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2.5 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Earned</p>
              <p className="text-lg font-bold text-emerald-400 font-mono">
                {isLoading ? '…' : `${(data?.totalCommissionEarned ?? 0).toFixed(2)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Influencer code */}
        {referralCode && (
          <>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-900 border border-amber-500/20 px-3 py-2">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Your influencer code</p>
                <p className="font-mono text-lg font-bold text-amber-400 tracking-widest">{referralCode}</p>
              </div>
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] shrink-0">
                <Star className="h-2.5 w-2.5 mr-1" /> Influencer
              </Badge>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-900/60 border border-slate-800 px-3 py-2">
              <p className="text-xs text-slate-400 font-mono break-all flex-1">{referralLink}</p>
              <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 h-7 gap-1.5 shrink-0" onClick={handleCopy}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </>
        )}

        {/* Referral list */}
        {!isLoading && data && data.referrals.length > 0 && (
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">People you referred</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {data.referrals.map((ref) => (
                <div key={ref.id} className="flex items-center justify-between rounded bg-slate-900 border border-slate-800 px-2.5 py-1.5">
                  <div>
                    <p className="text-xs font-medium text-white">{ref.fullName}</p>
                    {ref.username && <p className="text-[10px] text-slate-500">@{ref.username}</p>}
                  </div>
                  <p className="text-[10px] text-slate-600">{new Date(ref.joinedAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && data && data.referrals.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-2">No referrals yet. Share your link to start earning!</p>
        )}
      </CardContent>
    </Card>
  );
}

const ID_TYPES = [
  { value: 'national_id',       label: 'National ID' },
  { value: 'passport',          label: 'Passport' },
  { value: 'drivers_license',   label: 'Driver\'s License' },
  { value: 'refugee_id',        label: 'Refugee ID' },
  { value: 'military_id',       label: 'Military ID' },
];

const COUNTRIES = [
  'Uganda', 'Kenya', 'Tanzania', 'Rwanda', 'Burundi', 'South Sudan', 'DR Congo',
  'Ethiopia', 'Nigeria', 'Ghana', 'South Africa', 'Zambia', 'Zimbabwe', 'Malawi',
  'Mozambique', 'Angola', 'Cameroon', 'Côte d\'Ivoire', 'Senegal', 'Mali',
  'United Kingdom', 'United States', 'Canada', 'Australia', 'Other',
];

function getToken() {
  try { return JSON.parse(localStorage.getItem('ata-auth') || '{}').state?.token; }
  catch { return null; }
}

export default function Profile() {
  useSEO({ title: 'Profile Settings', path: '/profile', noindex: true });
  const { user, login } = useAuth();
  const { clientId } = useGoogleAuth();

  // ── Personal Info ──────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  // ── FICA / Identity ────────────────────────────────────
  const [ficaMode, setFicaMode] = useState(false);
  const [ficaFirstName, setFicaFirstName] = useState((user as any)?.fullName || '');
  const [ficaSurname, setFicaSurname] = useState((user as any)?.surname || '');
  const [ficaPhone, setFicaPhone] = useState((user as any)?.phone || '');
  const [ficaDob, setFicaDob] = useState((user as any)?.dateOfBirth || '');
  const [ficaIdType, setFicaIdType] = useState((user as any)?.idType || '');
  const [ficaIdNumber, setFicaIdNumber] = useState((user as any)?.idNumber || '');
  const [ficaCountry, setFicaCountry] = useState((user as any)?.country || '');
  const [savingFica, setSavingFica] = useState(false);

  // ── Avatar upload ──────────────────────────────────────
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // ── Username ───────────────────────────────────────────
  const [usernameMode, setUsernameMode] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  // ── Password ───────────────────────────────────────────
  const [pwMode, setPwMode] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [googleLoading, setGoogleLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const SITE_ORIGIN = 'https://atasportslive.com';

  const refreshUser = async (token: string) => {
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const u = await res.json(); login(token, u); }
  };

  // ── Handlers ───────────────────────────────────────────

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const token = getToken();
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fullName, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      login(token, data);
      setEditMode(false);
      toast.success('Profile updated');
    } catch (e: any) { toast.error(e.message || 'Failed to update profile'); }
    finally { setSaving(false); }
  };

  const handleSaveFica = async () => {
    setSavingFica(true);
    try {
      const token = getToken();
      const res = await fetch('/api/auth/fica', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fullName: ficaFirstName,
          surname: ficaSurname,
          phone: ficaPhone,
          dateOfBirth: ficaDob,
          idType: ficaIdType,
          idNumber: ficaIdNumber,
          country: ficaCountry,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      login(token, data);
      setFicaMode(false);
      toast.success('Identity verified!', { description: 'Your profile is now complete and withdrawals are unlocked.' });
    } catch (e: any) { toast.error(e.message || 'Failed to save verification'); }
    finally { setSavingFica(false); }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setUploadingAvatar(true);
    try {
      const token = getToken();
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/uploads/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      await refreshUser(token);
      toast.success('Profile photo updated');
    } catch (e: any) { toast.error(e.message || 'Upload failed'); }
    finally { setUploadingAvatar(false); e.target.value = ''; }
  };

  const handleSaveUsername = async () => {
    const u = newUsername.trim().toLowerCase();
    if (!u || u.length < 3) { toast.error('Username must be at least 3 characters'); return; }
    if (!/^[a-z0-9_]+$/.test(u)) { toast.error('Letters, numbers and underscores only'); return; }
    setSavingUsername(true);
    try {
      const token = getToken();
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fullName: user!.fullName, phone: user!.phone, username: u }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      login(token, data);
      setUsernameMode(false);
      setNewUsername('');
      toast.success('Username updated! This was your one-time change.');
    } catch (e: any) { toast.error(e.message || 'Failed to update username'); }
    finally { setSavingUsername(false); }
  };

  const handleChangePassword = async () => {
    if (!newPw || newPw.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    setSavingPw(true);
    try {
      const token = getToken();
      const res = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPwMode(false); setCurrentPw(''); setNewPw('');
      toast.success('Password updated');
    } catch (e: any) { toast.error(e.message || 'Failed to change password'); }
    finally { setSavingPw(false); }
  };

  const handleLinkGoogle = async (credentialResponse: any) => {
    setGoogleLoading(true);
    try {
      const token = getToken();
      const res = await fetch('/api/auth/google/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to link Google account');
      await refreshUser(token);
      toast.success('Google account linked successfully');
    } catch (e: any) { toast.error(e.message || 'Failed to link Google account'); }
    finally { setGoogleLoading(false); }
  };

  const handleUnlinkGoogle = async () => {
    if (!user?.hasPassword) {
      toast.error('Set a password first before unlinking Google — otherwise you won\'t be able to sign in.');
      return;
    }
    setGoogleLoading(true);
    try {
      const token = getToken();
      const res = await fetch('/api/auth/google/link', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unlink');
      await refreshUser(token);
      toast.success('Google account unlinked');
    } catch (e: any) { toast.error(e.message || 'Failed to unlink Google account'); }
    finally { setGoogleLoading(false); }
  };

  const handleCopyReferral = () => {
    const link = `${SITE_ORIGIN}/register?ref=${user?.referralCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!user) return null;

  const ficaCompleted = !!(user as any)?.ficaCompleted;
  const u = user as any;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Profile Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account details and sign-in methods</p>
        </div>

        {/* ── Identity Verification (FICA) ──────────────────────── */}
        <Card className={`backdrop-blur-sm ${ficaCompleted ? 'bg-teal-950/20 border-teal-500/30' : 'bg-amber-950/20 border-amber-500/30'}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  {ficaCompleted
                    ? <ShieldCheck className="h-4 w-4 text-teal-400" />
                    : <ShieldAlert className="h-4 w-4 text-amber-400" />
                  }
                  Identity Verification
                </CardTitle>
                <CardDescription className="mt-0.5">
                  {ficaCompleted
                    ? 'Your identity is verified — withdrawals are unlocked.'
                    : 'Required before your first withdrawal. Registration stays unchanged.'}
                </CardDescription>
              </div>
              <Badge className={ficaCompleted
                ? 'bg-teal-500/15 text-teal-400 border-teal-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'}>
                {ficaCompleted ? '✓ Verified' : 'Incomplete'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Avatar — always visible, optional */}
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt="Avatar" className="h-16 w-16 rounded-full object-cover border-2 border-slate-700" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
                    <span className="text-xl font-bold text-slate-400">
                      {(u.fullName?.[0] ?? '?').toUpperCase()}
                    </span>
                  </div>
                )}
                <label className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center cursor-pointer hover:bg-slate-600 transition-colors">
                  {uploadingAvatar ? <Loader2 className="h-3 w-3 animate-spin text-slate-300" /> : <Camera className="h-3 w-3 text-slate-300" />}
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploadingAvatar} />
                </label>
              </div>
              <div>
                <p className="text-white text-sm font-medium">{u.fullName} {u.surname ?? ''}</p>
                <p className="text-slate-500 text-xs">{u.email}</p>
                <p className="text-slate-600 text-[10px] mt-1">Profile photo is optional</p>
              </div>
            </div>

            {/* View mode — when not editing */}
            {!ficaMode && ficaCompleted && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: User,       label: 'First Name',  value: u.fullName },
                  { icon: User,       label: 'Surname',     value: u.surname },
                  { icon: Phone,      label: 'Phone',       value: u.phone },
                  { icon: Mail,       label: 'Email',       value: u.email },
                  { icon: Calendar,   label: 'Date of Birth', value: u.dateOfBirth },
                  { icon: CreditCard, label: 'ID Type',     value: ID_TYPES.find(t => t.value === u.idType)?.label ?? u.idType },
                  { icon: CreditCard, label: 'ID Number',   value: u.idNumber },
                  { icon: Globe,      label: 'Country',     value: u.country },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-2.5 rounded-lg bg-slate-900/60 border border-slate-800 px-3 py-2.5">
                    <Icon className="h-3.5 w-3.5 text-slate-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</p>
                      <p className="text-white text-sm font-medium truncate">{value || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Incomplete prompt */}
            {!ficaMode && !ficaCompleted && (
              <div className="rounded-lg bg-amber-950/30 border border-amber-500/20 px-4 py-3 text-sm text-amber-300/80">
                Complete the fields below to unlock withdrawals. This information is kept secure and used only for verification.
              </div>
            )}

            {/* Edit/fill form */}
            {ficaMode || !ficaCompleted ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-300 font-medium flex items-center gap-1"><User className="h-3 w-3" /> First Name *</label>
                    <Input value={ficaFirstName} onChange={e => setFicaFirstName(e.target.value)} placeholder="First name" className="bg-slate-900 border-slate-700 text-white h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-300 font-medium flex items-center gap-1"><User className="h-3 w-3" /> Surname *</label>
                    <Input value={ficaSurname} onChange={e => setFicaSurname(e.target.value)} placeholder="Last name" className="bg-slate-900 border-slate-700 text-white h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-300 font-medium flex items-center gap-1"><Phone className="h-3 w-3" /> Phone Number *</label>
                    <Input value={ficaPhone} onChange={e => setFicaPhone(e.target.value)} placeholder="+256..." className="bg-slate-900 border-slate-700 text-white h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-300 font-medium flex items-center gap-1"><Mail className="h-3 w-3" /> Email</label>
                    <Input value={u.email} readOnly className="bg-slate-800/50 border-slate-700 text-slate-400 h-9 text-sm cursor-not-allowed" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-300 font-medium flex items-center gap-1"><Calendar className="h-3 w-3" /> Date of Birth *</label>
                    <Input type="date" value={ficaDob} onChange={e => setFicaDob(e.target.value)} className="bg-slate-900 border-slate-700 text-white h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-300 font-medium flex items-center gap-1"><Globe className="h-3 w-3" /> Country *</label>
                    <select
                      value={ficaCountry}
                      onChange={e => setFicaCountry(e.target.value)}
                      className="w-full rounded-md bg-slate-900 border border-slate-700 text-white text-sm h-9 px-3 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="">Select country…</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-300 font-medium flex items-center gap-1"><CreditCard className="h-3 w-3" /> ID Type *</label>
                    <select
                      value={ficaIdType}
                      onChange={e => setFicaIdType(e.target.value)}
                      className="w-full rounded-md bg-slate-900 border border-slate-700 text-white text-sm h-9 px-3 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="">Select ID type…</option>
                      {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-300 font-medium flex items-center gap-1"><CreditCard className="h-3 w-3" /> ID Number *</label>
                    <Input value={ficaIdNumber} onChange={e => setFicaIdNumber(e.target.value)} placeholder="e.g. CM123456789" className="bg-slate-900 border-slate-700 text-white h-9 text-sm font-mono" />
                  </div>
                </div>

                <p className="text-[10px] text-slate-600">* Required fields. Your information is encrypted and never shared with third parties.</p>

                <div className="flex gap-2 justify-end pt-1">
                  {ficaCompleted && (
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setFicaMode(false)}>Cancel</Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleSaveFica}
                    disabled={savingFica}
                    className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold"
                  >
                    {savingFica ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving…</> : ficaCompleted ? 'Update Info' : 'Complete Verification'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => {
                setFicaFirstName(u.fullName || '');
                setFicaSurname(u.surname || '');
                setFicaPhone(u.phone || '');
                setFicaDob(u.dateOfBirth || '');
                setFicaIdType(u.idType || '');
                setFicaIdNumber(u.idNumber || '');
                setFicaCountry(u.country || '');
                setFicaMode(true);
              }}>
                Edit Verification Info
              </Button>
            )}
          </CardContent>
        </Card>

        {/* ── Personal Info ──────────────────────────────────────── */}
        <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <User className="h-4 w-4 text-teal-400" /> Personal Info
                </CardTitle>
                <CardDescription>Your display name and contact</CardDescription>
              </div>
              {!editMode && (
                <Button variant="outline" size="sm" className="border-primary/30 text-white hover:bg-primary/10"
                  onClick={() => { setEditMode(true); setFullName(user.fullName || ''); setPhone(user.phone || ''); }}>
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editMode ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-white font-medium">Display Name</label>
                  <Input value={fullName} onChange={e => setFullName(e.target.value)} className="bg-background/50 border-input text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white font-medium">Phone</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+256..." className="bg-background/50 border-input text-white" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setEditMode(false)}>Cancel</Button>
                  <Button size="sm" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold" onClick={handleSaveProfile} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-white">{user.fullName}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-white">{user.email}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-white">{user.phone}</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Username ───────────────────────────────────────────── */}
        <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <AtSign className="h-4 w-4 text-teal-400" /> Username
            </CardTitle>
            <CardDescription>
              Your public handle on ATA.{' '}
              {(user as any).usernameChangesCount >= 1
                ? 'Username can only be changed once — yours is now locked.'
                : 'You can change it once.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2.5">
              <AtSign className="h-4 w-4 text-slate-500 shrink-0" />
              <span className="font-mono text-white">{(user as any).username ?? '—'}</span>
              {(user as any).usernameChangesCount >= 1 && <Lock className="h-3.5 w-3.5 text-slate-600 ml-auto" />}
            </div>
            {(user as any).usernameChangesCount < 1 ? (
              <>
                {!usernameMode ? (
                  <Button variant="outline" size="sm" className="border-primary/30 text-white hover:bg-primary/10"
                    onClick={() => { setUsernameMode(true); setNewUsername((user as any).username ?? ''); }}>
                    Change Username
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-sm text-slate-400">New username</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">@</span>
                        <input
                          type="text"
                          value={newUsername}
                          onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
                          placeholder="your_username"
                          className="w-full pl-7 pr-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-teal-500"
                        />
                      </div>
                      <p className="text-xs text-slate-500">3–20 characters, letters, numbers, underscores only. This change is permanent.</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveUsername} disabled={savingUsername || newUsername.length < 3}
                        className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold">
                        {savingUsername ? 'Saving…' : 'Save Username'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setUsernameMode(false); setNewUsername(''); }}
                        className="border-slate-700 text-slate-300">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> Username is locked — it was already changed once.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Influencer Dashboard ───────────────────────────────── */}
        {(user as any).isInfluencer && (
          <InfluencerDashboard referralCode={user.referralCode} />
        )}

        {/* ── Refer & Earn (regular users only) ─────────────────── */}
        {user.referralCode && !(user as any).isInfluencer && (
          <Card className="bg-card/50 backdrop-blur-sm border-teal-500/20">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Gift className="h-4 w-4 text-teal-400" /> Refer &amp; Earn
              </CardTitle>
              <CardDescription>
                Share your link — earn <span className="text-teal-400 font-semibold">5% bonus</span> into your bonus wallet every time a referred user buys their first stream.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Your code</p>
                  <p className="font-mono text-lg font-bold text-teal-400 tracking-widest">{user.referralCode}</p>
                </div>
                <Button size="sm" variant="outline" className="border-teal-500/30 text-teal-400 hover:bg-teal-500/10 h-8 gap-1.5 shrink-0" onClick={handleCopyReferral}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </Button>
              </div>
              <div className="rounded-lg bg-slate-900/60 border border-slate-800 px-3 py-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Your referral link</p>
                <p className="text-xs text-slate-400 font-mono break-all">{SITE_ORIGIN}/register?ref={user.referralCode}</p>
              </div>
              <p className="text-xs text-slate-500">Bonus is credited once the referred user makes their first paid stream purchase. Bonus expires after 90 days.</p>
            </CardContent>
          </Card>
        )}

        {/* ── Sign-In Methods ────────────────────────────────────── */}
        <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-teal-400" /> Sign-In Methods
            </CardTitle>
            <CardDescription>Manage how you log into your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-primary/10">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-white">Email & Password</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {user.hasPassword ? (
                  <Badge variant="outline" className="text-teal-400 border-teal-500/30 bg-teal-500/10 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" /> Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10 text-xs">Not set</Badge>
                )}
                <Button variant="outline" size="sm" className="border-primary/30 text-white hover:bg-primary/10 text-xs h-7" onClick={() => setPwMode(v => !v)}>
                  {user.hasPassword ? 'Change' : 'Set Password'}
                </Button>
              </div>
            </div>
            {pwMode && (
              <div className="space-y-3 pb-2">
                {user.hasPassword && (
                  <div className="space-y-1">
                    <label className="text-xs text-white font-medium">Current Password</label>
                    <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="bg-background/50 border-input text-white h-8 text-sm" />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs text-white font-medium">New Password</label>
                  <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="bg-background/50 border-input text-white h-8 text-sm" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="text-muted-foreground h-7 text-xs" onClick={() => { setPwMode(false); setCurrentPw(''); setNewPw(''); }}>Cancel</Button>
                  <Button size="sm" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold h-7 text-xs" onClick={handleChangePassword} disabled={savingPw}>
                    {savingPw ? 'Saving…' : 'Save Password'}
                  </Button>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <div>
                  <p className="text-sm font-medium text-white">Google</p>
                  <p className="text-xs text-muted-foreground">
                    {user.googleLinked ? 'Linked — sign in with your Google account' : 'Not linked'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {user.googleLinked ? (
                  <>
                    <Badge variant="outline" className="text-teal-400 border-teal-500/30 bg-teal-500/10 text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Linked
                    </Badge>
                    <Button variant="outline" size="sm" className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-7"
                      onClick={handleUnlinkGoogle} disabled={googleLoading}>
                      <Unlink className="h-3 w-3 mr-1" /> Unlink
                    </Button>
                  </>
                ) : (
                  clientId ? (
                    <GoogleLogin onSuccess={handleLinkGoogle} onError={() => toast.error('Google sign-in failed')}
                      theme="filled_black" size="small" shape="rectangular" text="signin_with" width="160" />
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground border-primary/20 text-xs">Unavailable</Badge>
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
