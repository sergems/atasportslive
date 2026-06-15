import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { RootLayout } from "@/components/layout/RootLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";

import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Streams from "@/pages/streams/index";
import StreamDetail from "@/pages/streams/[id]";
import Games from "@/pages/games/index";
import GameDetail from "@/pages/games/[id]";
import Wallet from "@/pages/wallet";
import Transactions from "@/pages/transactions";
import Bets from "@/pages/bets";
import Notifications from "@/pages/notifications";
import AdminDashboard from "@/pages/admin/index";
import AdminStreams from "@/pages/admin/streams";
import AdminGames from "@/pages/admin/games";
import AdminUsers from "@/pages/admin/users";
import AdminWallets from "@/pages/admin/wallets";
import AdminReports from "@/pages/admin/reports";
import AdminVouchers from "@/pages/admin/vouchers";
import AdminAnnouncements from "@/pages/admin/announcements";
import NotFound from "@/pages/not-found";
import RefundPolicy from "@/pages/refund-policy";
import PrivacyPolicy from "@/pages/privacy-policy";
import Terms from "@/pages/terms";

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
        <Route path="/games">
          {() => <ProtectedRoute component={Games} />}
        </Route>
        <Route path="/games/:id">
          {() => <ProtectedRoute component={GameDetail} />}
        </Route>
        <Route path="/dashboard">
          {() => <ProtectedRoute component={Dashboard} />}
        </Route>
        <Route path="/wallet">
          {() => <ProtectedRoute component={Wallet} />}
        </Route>
        <Route path="/transactions">
          {() => <ProtectedRoute component={Transactions} />}
        </Route>
        <Route path="/bets">
          {() => <ProtectedRoute component={Bets} />}
        </Route>
        <Route path="/notifications">
          {() => <ProtectedRoute component={Notifications} />}
        </Route>
        <Route path="/admin">
          {() => <ProtectedRoute component={() => <AdminLayout><AdminDashboard /></AdminLayout>} adminOnly />}
        </Route>
        <Route path="/admin/streams">
          {() => <ProtectedRoute component={() => <AdminLayout><AdminStreams /></AdminLayout>} adminOnly />}
        </Route>
        <Route path="/admin/games">
          {() => <ProtectedRoute component={() => <AdminLayout><AdminGames /></AdminLayout>} adminOnly />}
        </Route>
        <Route path="/admin/users">
          {() => <ProtectedRoute component={() => <AdminLayout><AdminUsers /></AdminLayout>} adminOnly />}
        </Route>
        <Route path="/admin/wallets">
          {() => <ProtectedRoute component={() => <AdminLayout><AdminWallets /></AdminLayout>} adminOnly />}
        </Route>
        <Route path="/admin/reports">
          {() => <ProtectedRoute component={() => <AdminLayout><AdminReports /></AdminLayout>} adminOnly />}
        </Route>
        <Route path="/admin/vouchers">
          {() => <ProtectedRoute component={() => <AdminLayout><AdminVouchers /></AdminLayout>} adminOnly />}
        </Route>
        <Route path="/admin/announcements">
          {() => <ProtectedRoute component={() => <AdminLayout><AdminAnnouncements /></AdminLayout>} adminOnly />}
        </Route>
        <Route path="/terms" component={Terms} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/refund-policy" component={RefundPolicy} />
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
