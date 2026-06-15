import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { RootLayout } from "@/components/layout/RootLayout";

import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Streams from "@/pages/streams/index";
import StreamDetail from "@/pages/streams/[id]";
import Games from "@/pages/games/index";
import GameDetail from "@/pages/games/[id]";
import Wallet from "@/pages/wallet";
import Bets from "@/pages/bets";
import Notifications from "@/pages/notifications";
import AdminDashboard from "@/pages/admin/index";
import AdminStreams from "@/pages/admin/streams";
import AdminGames from "@/pages/admin/games";
import AdminUsers from "@/pages/admin/users";
import AdminWallets from "@/pages/admin/wallets";
import AdminReports from "@/pages/admin/reports";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType; adminOnly?: boolean }) {
  const { isAuthenticated, isAdmin } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
    else if (adminOnly && !isAdmin) setLocation("/dashboard");
  }, [isAuthenticated, isAdmin, setLocation, adminOnly]);

  if (!isAuthenticated) return null;
  if (adminOnly && !isAdmin) return null;
  return <Component />;
}

function Router() {
  return (
    <RootLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/streams" component={Streams} />
        <Route path="/streams/:id" component={StreamDetail} />
        <Route path="/games" component={Games} />
        <Route path="/games/:id" component={GameDetail} />
        <Route path="/dashboard">
          {() => <ProtectedRoute component={Dashboard} />}
        </Route>
        <Route path="/wallet">
          {() => <ProtectedRoute component={Wallet} />}
        </Route>
        <Route path="/bets">
          {() => <ProtectedRoute component={Bets} />}
        </Route>
        <Route path="/notifications">
          {() => <ProtectedRoute component={Notifications} />}
        </Route>
        <Route path="/admin">
          {() => <ProtectedRoute component={AdminDashboard} adminOnly />}
        </Route>
        <Route path="/admin/streams">
          {() => <ProtectedRoute component={AdminStreams} adminOnly />}
        </Route>
        <Route path="/admin/games">
          {() => <ProtectedRoute component={AdminGames} adminOnly />}
        </Route>
        <Route path="/admin/users">
          {() => <ProtectedRoute component={AdminUsers} adminOnly />}
        </Route>
        <Route path="/admin/wallets">
          {() => <ProtectedRoute component={AdminWallets} adminOnly />}
        </Route>
        <Route path="/admin/reports">
          {() => <ProtectedRoute component={AdminReports} adminOnly />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </RootLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster theme="dark" position="bottom-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
