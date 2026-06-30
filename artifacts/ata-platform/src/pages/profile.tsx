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
import { CheckCircle, Mail, Phone, User, Link2, Unlink, KeyRound } from 'lucide-react';

export default function Profile() {
  useSEO({ title: 'Profile Settings', path: '/profile', noindex: true });
  const { user, login } = useAuth();
  const { clientId } = useGoogleAuth();

  const [editMode, setEditMode] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  const [pwMode, setPwMode] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [googleLoading, setGoogleLoading] = useState(false);

  const refreshUser = async (token: string) => {
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const u = await res.json();
      login(token, u);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('ata-auth') ? JSON.parse(localStorage.getItem('ata-auth')!).state?.token : null;
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
    } catch (e: any) {
      toast.error(e.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPw || newPw.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    setSavingPw(true);
    try {
      const token = JSON.parse(localStorage.getItem('ata-auth') || '{}').state?.token;
      const res = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPwMode(false);
      setCurrentPw('');
      setNewPw('');
      toast.success('Password updated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to change password');
    } finally {
      setSavingPw(false);
    }
  };

  const handleLinkGoogle = async (credentialResponse: any) => {
    setGoogleLoading(true);
    try {
      const token = JSON.parse(localStorage.getItem('ata-auth') || '{}').state?.token;
      const res = await fetch('/api/auth/google/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to link Google account');
      await refreshUser(token);
      toast.success('Google account linked successfully');
    } catch (e: any) {
      toast.error(e.message || 'Failed to link Google account');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    if (!user?.hasPassword) {
      toast.error('Set a password first before unlinking Google — otherwise you won\'t be able to sign in.');
      return;
    }
    setGoogleLoading(true);
    try {
      const token = JSON.parse(localStorage.getItem('ata-auth') || '{}').state?.token;
      const res = await fetch('/api/auth/google/link', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unlink');
      await refreshUser(token);
      toast.success('Google account unlinked');
    } catch (e: any) {
      toast.error(e.message || 'Failed to unlink Google account');
    } finally {
      setGoogleLoading(false);
    }
  };

  if (!user) return null;

  const getToken = () => {
    try { return JSON.parse(localStorage.getItem('ata-auth') || '{}').state?.token; }
    catch { return null; }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Profile Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account details and sign-in methods</p>
        </div>

        {/* Profile info */}
        <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <User className="h-4 w-4 text-teal-400" /> Personal Info
                </CardTitle>
                <CardDescription>Your name and contact details</CardDescription>
              </div>
              {!editMode && (
                <Button variant="outline" size="sm" className="border-primary/30 text-white hover:bg-primary/10" onClick={() => { setEditMode(true); setFullName(user.fullName || ''); setPhone(user.phone || ''); }}>
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editMode ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-white font-medium">Full Name</label>
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

        {/* Sign-in methods */}
        <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-teal-400" /> Sign-In Methods
            </CardTitle>
            <CardDescription>Manage how you log into your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Email/Password */}
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
                <Button variant="outline" size="sm" className="border-primary/30 text-white hover:bg-primary/10 text-xs h-7"
                  onClick={() => setPwMode(v => !v)}>
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

            {/* Google */}
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
                    <Button variant="outline" size="sm"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-7"
                      onClick={handleUnlinkGoogle} disabled={googleLoading}>
                      <Unlink className="h-3 w-3 mr-1" /> Unlink
                    </Button>
                  </>
                ) : (
                  clientId ? (
                    <GoogleLogin
                      onSuccess={handleLinkGoogle}
                      onError={() => toast.error('Google sign-in failed')}
                      theme="filled_black"
                      size="small"
                      shape="rectangular"
                      text="signin_with"
                      width="160"
                    />
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
