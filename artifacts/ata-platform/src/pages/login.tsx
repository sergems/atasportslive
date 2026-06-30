import React, { useEffect, useState } from 'react';
import { useSEO } from '@/lib/seo';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { useGoogleAuth } from '@/lib/google-auth';
import { useLogin } from '@workspace/api-client-react';
import { loginSchema } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleLogin } from '@react-oauth/google';

export default function Login() {
  useSEO({ title: 'Sign In', path: '/login', noindex: true });
  const { isAuthenticated, login } = useAuth();
  const { clientId } = useGoogleAuth();
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const { user } = useAuth();

  const roleRedirect = (role?: string) => {
    if (role === 'admin') return '/admin';
    if (role === 'finance') return '/finance/dashboard';
    return '/streams';
  };

  useEffect(() => {
    if (isAuthenticated) {
      setLocation(roleRedirect(user?.role));
    }
  }, [isAuthenticated, user, setLocation]);

  const onSubmit = (data: any) => {
    setLoginError(null);
    loginMutation.mutate({ data }, {
      onSuccess: (res: any) => {
        login(res.accessToken, res.user);
        const firstName = res.user.fullName?.split(' ')[0] || res.user.email?.split('@')[0] || 'there';
        toast.success(`Welcome back, ${firstName}! 👋`);
        setLocation(roleRedirect(res.user.role));
      },
      onError: (err: any) => {
        const body = err?.response?.data || err?.data || {};
        if (body?.reason === 'password_reset_required' && body?.email) {
          setLocation(`/set-password?email=${encodeURIComponent(body.email)}`);
          return;
        }
        const msg = body?.error || err?.message || 'Invalid email or password. Please try again.';
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

  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight text-white">Welcome back</CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your email to sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clientId && (
            <div className="mb-4 flex flex-col items-center gap-3">
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
                <span className="text-xs text-muted-foreground">or continue with email</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="m@example.com"
                        type="email"
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
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className={`bg-background/50 border-input text-white ${loginError ? 'border-red-500/60' : ''}`}
                        {...field}
                        onChange={(e) => { field.onChange(e); setLoginError(null); }}
                      />
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
  );
}
