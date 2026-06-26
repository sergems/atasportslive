import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

const schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm:  z.string(),
}).refine(d => d.password === d.confirm, {
  message: "Passwords don't match",
  path: ['confirm'],
});

type FormValues = z.infer<typeof schema>;

export default function SetPassword() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.title = 'Set Your Password — ATA Sports Live'; }, []);

  const params = new URLSearchParams(window.location.search);
  const email = params.get('email') || '';

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = async (data: FormValues) => {
    if (!email) {
      setError('Missing email. Please go back to the login page.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword: data.password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to set password');
      login(body.accessToken, body.user);
      toast.success('Password set! Welcome to ATA Sports Live.');
      setLocation(body.user.role === 'admin' ? '/admin' : '/streams');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card/50 backdrop-blur-sm border-primary/20 text-center">
          <CardContent className="pt-8 pb-6">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-white font-semibold">No email provided</p>
            <p className="text-slate-400 text-sm mt-1">Please start from the <Link href="/login" className="text-teal-400 hover:text-teal-300">login page</Link>.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-teal-500/15 border border-teal-500/30">
              <ShieldCheck className="h-7 w-7 text-teal-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">Set your password</CardTitle>
          <CardDescription className="text-muted-foreground">
            Welcome! Your account was pre-created for you.<br />
            Choose a password to activate it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-2.5 rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-2.5">
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
                      <Input
                        type="password"
                        placeholder="At least 8 characters"
                        className={`bg-background/50 border-input text-white ${error ? 'border-red-500/60' : ''}`}
                        {...field}
                        onChange={(e) => { field.onChange(e); setError(null); }}
                      />
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
                      <Input
                        type="password"
                        placeholder="Repeat your password"
                        className={`bg-background/50 border-input text-white ${error ? 'border-red-500/60' : ''}`}
                        {...field}
                        onChange={(e) => { field.onChange(e); setError(null); }}
                      />
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
            </form>
          </Form>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-center text-slate-500 w-full">
            Not your account?{' '}
            <Link href="/login" className="text-teal-400 hover:text-teal-300 transition-colors">
              Back to login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
