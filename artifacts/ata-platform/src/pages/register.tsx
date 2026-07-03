import React, { useEffect, useState } from 'react';
import { useSEO } from '@/lib/seo';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { useGoogleAuth } from '@/lib/google-auth';
import { useRegister } from '@workspace/api-client-react';
import { registerSchema } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { GoogleLogin } from '@react-oauth/google';
import { Gift } from 'lucide-react';

/** Read ?ref=CODE from the URL at page load. */
function getReferralCodeFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('ref');
    return code ? code.toUpperCase().trim() : null;
  } catch {
    return null;
  }
}

export default function Register() {
  const { isAuthenticated, login } = useAuth();
  const { clientId } = useGoogleAuth();
  const [, setLocation] = useLocation();
  const registerMutation = useRegister();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(() => getReferralCodeFromUrl());
  const [referralInput, setReferralInput] = useState(() => getReferralCodeFromUrl() ?? '');

  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      username: '',
      password: '',
      fullName: '',
      phone: '',
    },
  });

  useSEO({ title: 'Create Your Account', path: '/register', noindex: true });
  useEffect(() => {
    if (isAuthenticated) {
      setLocation('/dashboard');
    }
  }, [isAuthenticated, setLocation]);

  const effectiveReferralCode = referralInput.trim().toUpperCase() || null;

  const onSubmit = (data: any) => {
    setGoogleError(null);
    registerMutation.mutate(
      { data: { ...data, ...(effectiveReferralCode ? { referralCode: effectiveReferralCode } : {}) } },
      {
        onSuccess: (res: any) => {
          login(res.accessToken, res.user);
          toast.success('Registration successful');
          setLocation('/dashboard');
        },
        onError: (err: any) => {
          toast.error('Registration failed', { description: err?.message || 'Something went wrong' });
        },
      }
    );
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      const body: Record<string, string> = { credential: credentialResponse.credential };
      if (effectiveReferralCode) body.referralCode = effectiveReferralCode;

      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google sign-in failed');
      login(data.accessToken, data.user);
      const firstName = data.user.fullName?.split(' ')[0] || 'there';
      toast.success(`Welcome, ${firstName}! 🎉`);
      setLocation('/dashboard');
    } catch (err: any) {
      setGoogleError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight text-white">Create an account</CardTitle>
          <CardDescription className="text-muted-foreground">
            Join the ultimate sports streaming & betting platform
          </CardDescription>
          {effectiveReferralCode && (
            <div className="flex items-center justify-center gap-1.5 mt-1 rounded-lg bg-teal-500/10 border border-teal-500/20 px-3 py-1.5">
              <Gift className="h-3.5 w-3.5 text-teal-400 shrink-0" />
              <span className="text-xs text-teal-300 font-medium">
                Referral code <span className="font-mono font-bold">{effectiveReferralCode}</span> applied
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {clientId && (
            <div className="mb-4 flex flex-col items-center gap-3">
              <div className="flex justify-center w-full">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setGoogleError('Google sign-in failed. Please try again.')}
                  theme="filled_black"
                  size="large"
                  shape="rectangular"
                  width="368"
                  text="signup_with"
                />
              </div>
              {googleError && (
                <p className="text-sm text-red-400">{googleError}</p>
              )}
              <div className="flex items-center w-full gap-3">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-xs text-muted-foreground">or sign up with email</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" className="bg-background/50 border-input text-white" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Email</FormLabel>
                    <FormControl>
                      <Input placeholder="m@example.com" type="email" className="bg-background/50 border-input text-white" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Username</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                        <Input
                          placeholder="your_username"
                          autoComplete="username"
                          className="bg-background/50 border-input text-white pl-7"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        />
                      </div>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Letters, numbers and underscores only. Used to log in.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+256..." type="tel" className="bg-background/50 border-input text-white" {...field} />
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
                      <Input type="password" placeholder="••••••••" className="bg-background/50 border-input text-white" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Referral code — optional manual entry */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-white flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5 text-teal-400" />
                  Referral Code <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  placeholder="e.g. ABCD1234"
                  value={referralInput}
                  onChange={e => setReferralInput(e.target.value.toUpperCase())}
                  className="bg-background/50 border-input text-white font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal"
                  maxLength={10}
                />
                {effectiveReferralCode && (
                  <p className="text-xs text-teal-400 flex items-center gap-1">
                    <Gift className="h-3 w-3" /> Code applied — you'll help someone earn a bonus!
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold" disabled={registerMutation.isPending || googleLoading}>
                {registerMutation.isPending ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-teal-400 hover:text-teal-300 font-semibold transition-colors">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
