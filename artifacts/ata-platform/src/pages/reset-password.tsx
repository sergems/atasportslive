import React, { useEffect, useState } from 'react';
import { useSEO } from '@/lib/seo';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Eye, EyeOff, KeyRound, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPassword() {
  useSEO({ title: 'Reset Password', path: '/reset-password', noindex: true });
  const [, setLocation] = useLocation();
  const { login } = useAuth();

  // Parse token + email from query string
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';
  const email = params.get('email') || '';

  const [newPw, setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [showCf, setShowCf]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [done, setDone]       = useState(false);

  // If no token in URL, redirect to login
  useEffect(() => {
    if (!token || !email) setLocation('/login');
  }, [token, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPw.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPw !== confirmPw) { setError("Passwords don't match"); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, newPassword: newPw }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to reset password');
      login(body.accessToken, body.user);
      setDone(true);
      const firstName = body.user.fullName?.split(' ')[0] || 'there';
      toast.success(`Password reset! Welcome back, ${firstName}! 🎉`);
      setTimeout(() => setLocation('/dashboard'), 1500);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) return null;

  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader className="space-y-1 text-center items-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-teal-500/15 border border-teal-500/30 mb-1">
            {done
              ? <CheckCircle2 className="h-7 w-7 text-teal-400" />
              : <KeyRound className="h-7 w-7 text-teal-400" />
            }
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            {done ? 'Password reset!' : 'Choose a new password'}
          </CardTitle>
          <CardDescription>
            {done
              ? 'Redirecting you to your dashboard…'
              : `Setting a new password for ${email}`
            }
          </CardDescription>
        </CardHeader>
        {!done && (
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm text-white font-medium">New Password</label>
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={e => { setNewPw(e.target.value); setError(null); }}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    className={`bg-background/50 border-input text-white pr-10 ${error ? 'border-red-500/60' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-white font-medium">Confirm Password</label>
                <div className="relative">
                  <Input
                    type={showCf ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={e => { setConfirmPw(e.target.value); setError(null); }}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    className={`bg-background/50 border-input text-white pr-10 ${error ? 'border-red-500/60' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCf(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    tabIndex={-1}
                  >
                    {showCf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3">
                  <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-300 leading-snug">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
                disabled={loading}
              >
                {loading ? 'Resetting…' : 'Reset Password & Sign In'}
              </Button>

              <button
                type="button"
                onClick={() => setLocation('/login')}
                className="w-full text-center text-sm text-slate-400 hover:text-white transition-colors pt-1"
              >
                ← Back to sign in
              </button>
            </form>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
