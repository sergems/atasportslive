import React, { useEffect, useState } from 'react';
import { useSEO } from '@/lib/seo';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { useGoogleAuth } from '@/lib/google-auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLogin } from '@workspace/api-client-react';
import { loginSchema } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, Mail, AtSign, ShieldCheck, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleLogin } from '@react-oauth/google';

type LoginTab = 'email' | 'username';

// ── Set-password dialog ────────────────────────────────────────────────────────

const setPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm:  z.string(),
}).refine(d => d.password === d.confirm, {
  message: "Passwords don't match",
  path: ['confirm'],
});

type SetPasswordValues = z.infer<typeof setPasswordSchema>;

function SetPasswordDialog({
  email,
  nonce,
  open,
  onSuccess,
  onBack,
}: {
  email: string;
  nonce: string;
  open: boolean;
  onSuccess: (accessToken: string, user: any) => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [showPw, setShowPw]   = useState(false);
  const [showCf, setShowCf]   = useState(false);

  const form = useForm<SetPasswordValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  // Reset form whenever the dialog re-opens for a new email
  useEffect(() => {
    if (open) {
      form.reset();
      setError(null);
    }
  }, [open, email]);

  const onSubmit = async (data: SetPasswordValues) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nonce, newPassword: data.password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to set password');
      onSuccess(body.accessToken, body.user);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md bg-card/95 backdrop-blur-sm border-primary/20"
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader className="text-center items-center">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-teal-500/15 border border-teal-500/30 mb-1">
            <ShieldCheck className="h-7 w-7 text-teal-400" />
          </div>
          <DialogTitle className="text-xl font-bold text-white">
            Set your password
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
            Your account was pre-created for you.<br />
            Choose a password to activate it and sign in.
          </DialogDescription>
        </DialogHeader>

        {/* Account badge */}
        <div className="flex items-center gap-2.5 rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-2.5">
          <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider leading-none">Account</p>
            <p className="text-sm text-white font-medium truncate mt-0.5">{email}</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPw ? 'text' : 'password'}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        className={`bg-background/50 border-input text-white pr-10 ${error ? 'border-red-500/60' : ''}`}
                        {...field}
                        onChange={e => { field.onChange(e); setError(null); }}
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
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Confirm Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showCf ? 'text' : 'password'}
                        placeholder="Repeat your password"
                        autoComplete="new-password"
                        className={`bg-background/50 border-input text-white pr-10 ${error ? 'border-red-500/60' : ''}`}
                        {...field}
                        onChange={e => { field.onChange(e); setError(null); }}
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
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
              {loading ? 'Activating account…' : 'Set Password & Sign In'}
            </Button>

            <button
              type="button"
              onClick={onBack}
              disabled={loading}
              className="w-full text-center text-sm text-slate-400 hover:text-white transition-colors pt-1 disabled:pointer-events-none"
            >
              ← Back to sign in
            </button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main login page ────────────────────────────────────────────────────────────

export default function Login() {
  useSEO({ title: 'Sign In', path: '/login', noindex: true });
  const { isAuthenticated, login } = useAuth();
  const { clientId } = useGoogleAuth();
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();
  const isMobile = useIsMobile();
  const [loginError, setLoginError]         = useState<string | null>(null);
  const [googleLoading, setGoogleLoading]   = useState(false);
  const [activeTab, setActiveTab]           = useState<LoginTab>('email');
  const [setPasswordChallenge, setSetPasswordChallenge] = useState<{ email: string; nonce: string } | null>(null);
  const [showPassword, setShowPassword]     = useState(false);

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  const { user } = useAuth();

  const roleRedirect = (role?: string) => {
    if (role === 'admin' || role === 'manager' || role === 'content_editor') return '/admin';
    if (role === 'finance') return '/finance/dashboard';
    return isMobile ? '/' : '/dashboard';
  };

  useEffect(() => {
    if (isAuthenticated) {
      setLocation(roleRedirect(user?.role));
    }
  }, [isAuthenticated, user, setLocation]);

  const handleTabChange = (tab: LoginTab) => {
    setActiveTab(tab);
    form.setValue('identifier', '');
    setLoginError(null);
  };

  const onSubmit = (data: any) => {
    setLoginError(null);
    loginMutation.mutate({ data }, {
      onSuccess: (res: any) => {
        login(res.accessToken, res.user);
        const firstName = res.user.fullName?.split(' ')[0] || res.user.email?.split('@')[0] || 'there';
        toast.success(`Welcome back, ${firstName}! 👋`);
        if (res.displacedExistingSession) {
          setTimeout(() => {
            toast.warning('Another session was signed out', {
              description: 'Your account was already logged in on another device — that session has been ended.',
              duration: 8000,
            });
          }, 800);
        }
        setLocation(roleRedirect(res.user.role));
      },
      onError: (err: any) => {
        const body = err?.response?.data || err?.data || {};
        if (body?.reason === 'password_reset_required' && body?.email && body?.nonce) {
          // Open the inline set-password dialog instead of navigating away
          setSetPasswordChallenge({ email: body.email, nonce: body.nonce });
          return;
        }
        const msg = body?.error || err?.message || 'Invalid credentials. Please try again.';
        setLoginError(msg);
      }
    });
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setGoogleLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google sign-in failed');
      login(data.accessToken, data.user);
      const firstName = data.user.fullName?.split(' ')[0] || 'there';
      toast.success(`Welcome back, ${firstName}! 👋`);
      setLocation(roleRedirect(data.user.role));
    } catch (err: any) {
      setLoginError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handlePasswordSet = (accessToken: string, user: any) => {
    login(accessToken, user);
    const firstName = user.fullName?.split(' ')[0] || user.email?.split('@')[0] || 'there';
    toast.success(`Password set! Welcome, ${firstName}! 🎉`);
    setSetPasswordChallenge(null);
    setLocation(roleRedirect(user.role));
  };

  return (
    <>
      {/* Inline set-password dialog — shown when a migrated user attempts to log in */}
      {setPasswordChallenge && (
        <SetPasswordDialog
          email={setPasswordChallenge.email}
          nonce={setPasswordChallenge.nonce}
          open={true}
          onSuccess={handlePasswordSet}
          onBack={() => setSetPasswordChallenge(null)}
        />
      )}

      <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight text-white">Welcome back</CardTitle>
            <CardDescription className="text-muted-foreground">
              Sign in to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Google Sign-In */}
            {clientId && (
              <div className="mb-5 flex flex-col items-center gap-3">
                <div className="flex justify-center w-full">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setLoginError('Google sign-in failed. Please try again.')}
                    theme="filled_black"
                    size="large"
                    shape="rectangular"
                    width="368"
                    text="signin_with"
                  />
                </div>
                <div className="flex items-center w-full gap-3">
                  <div className="flex-1 h-px bg-border/50" />
                  <span className="text-xs text-muted-foreground">or sign in with</span>
                  <div className="flex-1 h-px bg-border/50" />
                </div>
              </div>
            )}

            {/* Email / Username tabs */}
            <div className="flex rounded-lg bg-background/40 border border-border/40 p-1 mb-5">
              <button
                type="button"
                onClick={() => handleTabChange('email')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all duration-200 ${
                  activeTab === 'email'
                    ? 'bg-teal-500 text-slate-950 shadow-sm'
                    : 'text-muted-foreground hover:text-white'
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                Email
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('username')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all duration-200 ${
                  activeTab === 'username'
                    ? 'bg-teal-500 text-slate-950 shadow-sm'
                    : 'text-muted-foreground hover:text-white'
                }`}
              >
                <AtSign className="h-3.5 w-3.5" />
                Username
              </button>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="identifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">
                        {activeTab === 'email' ? 'Email or Phone' : 'Username'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={activeTab === 'email' ? 'email@example.com' : 'username'}
                          type="text"
                          autoComplete={activeTab === 'email' ? 'email' : 'username'}
                          className={`bg-background/50 border-input text-white ${loginError ? 'border-red-500/60' : ''}`}
                          {...field}
                          onChange={(e) => { field.onChange(e); setLoginError(null); }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            className={`bg-background/50 border-input text-white pr-10 ${loginError ? 'border-red-500/60' : ''}`}
                            {...field}
                            onChange={(e) => { field.onChange(e); setLoginError(null); }}
                          />
                          <button
                            type="button"
                            onMouseDown={() => setShowPassword(true)}
                            onMouseUp={() => setShowPassword(false)}
                            onMouseLeave={() => setShowPassword(false)}
                            onTouchStart={() => setShowPassword(true)}
                            onTouchEnd={() => setShowPassword(false)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors select-none"
                            aria-label={showPassword ? 'Hide password' : 'Hold to show password'}
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {loginError && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3">
                    <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-300 leading-snug">{loginError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold"
                  disabled={loginMutation.isPending || googleLoading}
                >
                  {loginMutation.isPending ? 'Signing in…' : 'Sign In'}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-sm text-center text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-teal-400 hover:text-teal-300 font-semibold transition-colors">
                Sign up
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
