import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { useRegister } from '@workspace/api-client-react';
import { registerSchema } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';

export default function Register() {
  const { isAuthenticated, login } = useAuth();
  const [, setLocation] = useLocation();
  const registerMutation = useRegister();

  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      fullName: '',
      phone: '',
    },
  });

  useEffect(() => {
    document.title = 'Register - ATA Platform';
    if (isAuthenticated) {
      setLocation('/dashboard');
    }
  }, [isAuthenticated, setLocation]);

  const onSubmit = (data: any) => {
    registerMutation.mutate({ data }, {
      onSuccess: (res) => {
        login(res.accessToken, res.user);
        toast.success('Registration successful');
        setLocation('/dashboard');
      },
      onError: (err: any) => {
        toast.error('Registration failed', { description: err?.message || 'Something went wrong' });
      }
    });
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card/50 backdrop-blur-sm border-primary/20">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight text-white">Create an account</CardTitle>
          <CardDescription className="text-muted-foreground">
            Join the ultimate sports streaming & betting platform
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold" disabled={registerMutation.isPending}>
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
