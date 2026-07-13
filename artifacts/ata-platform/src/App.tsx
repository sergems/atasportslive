import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { GoogleAuthProvider } from "@/lib/google-auth";
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
import Live from "@/pages/live";
import Live2 from "@/pages/live-2";
import Live3 from "@/pages/live-3";
import Upcoming from "@/pages/upcoming";
import Fixtures from "@/pages/fixtures";
import Highlights from "@/pages/highlights";
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
import AdminHighlights from "@/pages/admin/highlights";
import AdminSettings from "@/pages/admin/settings";
import AdminLivestreamSettings from "@/pages/admin/livestream-settings";
import AdminSlides from "@/pages/admin/slides";
import AdminAds from "@/pages/admin/ads";
import AdminWithdrawals from "@/pages/admin/withdrawals";
import AdminPromotions from "@/pages/admin/promotions";
import AdminBets from "@/pages/admin/bets";
import AdminSessions from "@/pages/admin/sessions";
import AdminInfluencers from "@/pages/admin/influencers";
import FinanceDashboard from "@/pages/finance/dashboard";
import FinanceWithdrawals from "@/pages/finance/withdrawals";
import { FinanceLayout } from "@/components/layout/FinanceLayout";
import Subscriptions from "@/pages/subscriptions";
import Profile from "@/pages/profile";
import SetPassword from "@/pages/set-password";
import NotFound from "@/pages/not-found";
import RefundPolicy from "@/pages/refund-policy";
import PrivacyPolicy from "@/pages/privacy-policy";
import Terms from "@/pages/terms";

// Role sets used by route guards
const CE_ROLES  = ['admin', 'manager', 'content_editor']; // content editor and above
const MGR_ROLES = ['admin', 'manager'];                   // manager and above
const FIN_ROLES = ['admin', 'manager', 'finance'];        // finance and above
const ADM_ROLES = ['admin'];                              // admin only

/**
 * AdminIndex — shows the financial admin dashboard to admins only.
 * Managers and content editors are sent to their first accessible page.
 */
function AdminIndex() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && user.role !== 'admin') {
      setLocation('/admin/slides');
    }
  }, [user?.role, setLocation]);

  if (!user || user.role !== 'admin') return null;
  return <AdminLayout><AdminDashboard /></AdminLayout>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * ProtectedRoute — redirects to /login if not authenticated, to /dashboard if
 * authenticated but the user's role is not in `allowedRoles`.
 * If `allowedRoles` is omitted any authenticated user may access the route.
 */
function ProtectedRoute({
  component: Component,
  allowedRoles,
}: {
  component: React.ComponentType;
  allowedRoles?: string[];
}) {
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user?.role, setLocation]);

  if (!isAuthenticated) return null;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) return null;
  return <Component />;
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [location]);
  return null;
}

function Router() {
  return (
    <RootLayout>
      <ScrollToTop />
      <Switch>
        {/* ── Public routes ─────────────────────────────────────────────────── */}
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/streams" component={Streams} />
        <Route path="/streams/:id" component={StreamDetail} />
        <Route path="/live" component={Live} />
        <Route path="/live-2" component={Live2} />
        <Route path="/live-3" component={Live3} />
        <Route path="/upcoming" component={Upcoming} />
        <Route path="/fixtures" component={Fixtures} />
        <Route path="/highlights" component={Highlights} />
        <Route path="/terms" component={Terms} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/refund-policy" component={RefundPolicy} />
        <Route path="/set-password" component={SetPassword} />

        {/* ── Authenticated user routes ──────────────────────────────────── */}
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
        <Route path="/subscriptions">
          {() => <ProtectedRoute component={Subscriptions} />}
        </Route>
        <Route path="/profile">
          {() => <ProtectedRoute component={Profile} />}
        </Route>

        {/* ── Admin panel — content_editor + manager + admin ─────────────── */}
        <Route path="/admin">
          {() => <ProtectedRoute allowedRoles={CE_ROLES} component={AdminIndex} />}
        </Route>
        <Route path="/admin/slides">
          {() => <ProtectedRoute allowedRoles={CE_ROLES} component={() => <AdminLayout><AdminSlides /></AdminLayout>} />}
        </Route>
        <Route path="/admin/highlights">
          {() => <ProtectedRoute allowedRoles={CE_ROLES} component={() => <AdminLayout><AdminHighlights /></AdminLayout>} />}
        </Route>
        <Route path="/admin/announcements">
          {() => <ProtectedRoute allowedRoles={CE_ROLES} component={() => <AdminLayout><AdminAnnouncements /></AdminLayout>} />}
        </Route>
        <Route path="/admin/ads">
          {() => <ProtectedRoute allowedRoles={CE_ROLES} component={() => <AdminLayout><AdminAds /></AdminLayout>} />}
        </Route>
        <Route path="/admin/users">
          {() => <ProtectedRoute allowedRoles={CE_ROLES} component={() => <AdminLayout><AdminUsers /></AdminLayout>} />}
        </Route>

        {/* ── Admin panel — manager + admin only ────────────────────────── */}
        <Route path="/admin/streams">
          {() => <ProtectedRoute allowedRoles={MGR_ROLES} component={() => <AdminLayout><AdminStreams /></AdminLayout>} />}
        </Route>
        <Route path="/admin/games">
          {() => <ProtectedRoute allowedRoles={MGR_ROLES} component={() => <AdminLayout><AdminGames /></AdminLayout>} />}
        </Route>
        <Route path="/admin/bets">
          {() => <ProtectedRoute allowedRoles={MGR_ROLES} component={() => <AdminLayout><AdminBets /></AdminLayout>} />}
        </Route>
        <Route path="/admin/wallets">
          {() => <ProtectedRoute allowedRoles={MGR_ROLES} component={() => <AdminLayout><AdminWallets /></AdminLayout>} />}
        </Route>
        <Route path="/admin/withdrawals">
          {() => <ProtectedRoute allowedRoles={MGR_ROLES} component={() => <AdminLayout><AdminWithdrawals /></AdminLayout>} />}
        </Route>
        <Route path="/admin/influencers">
          {() => <ProtectedRoute allowedRoles={MGR_ROLES} component={() => <AdminLayout><AdminInfluencers /></AdminLayout>} />}
        </Route>
        <Route path="/admin/promotions">
          {() => <ProtectedRoute allowedRoles={MGR_ROLES} component={() => <AdminLayout><AdminPromotions /></AdminLayout>} />}
        </Route>
        <Route path="/admin/vouchers">
          {() => <ProtectedRoute allowedRoles={MGR_ROLES} component={() => <AdminLayout><AdminVouchers /></AdminLayout>} />}
        </Route>
        <Route path="/admin/reports">
          {() => <ProtectedRoute allowedRoles={MGR_ROLES} component={() => <AdminLayout><AdminReports /></AdminLayout>} />}
        </Route>
        <Route path="/admin/sessions">
          {() => <ProtectedRoute allowedRoles={ADM_ROLES} component={() => <AdminLayout><AdminSessions /></AdminLayout>} />}
        </Route>
        <Route path="/admin/settings">
          {() => <ProtectedRoute allowedRoles={MGR_ROLES} component={() => <AdminLayout><AdminSettings /></AdminLayout>} />}
        </Route>
        <Route path="/admin/livestream-settings">
          {() => <ProtectedRoute allowedRoles={MGR_ROLES} component={() => <AdminLayout><AdminLivestreamSettings /></AdminLayout>} />}
        </Route>

        {/* ── Finance routes (finance + manager + admin) ─────────────── */}
        <Route path="/finance/dashboard">
          {() => <ProtectedRoute allowedRoles={FIN_ROLES} component={() => <FinanceLayout><FinanceDashboard /></FinanceLayout>} />}
        </Route>
        <Route path="/finance/withdrawals">
          {() => <ProtectedRoute allowedRoles={FIN_ROLES} component={() => <FinanceLayout><FinanceWithdrawals /></FinanceLayout>} />}
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
        <GoogleAuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </WouterRouter>
          <Toaster theme="dark" position="bottom-right" />
        </GoogleAuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
