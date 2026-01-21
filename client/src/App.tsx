import { useState, useEffect, lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LoginModal } from "@/components/login-modal";
import { BusinessModeProvider } from "@/contexts/BusinessModeContext";
import HeaderStoreSwitcher from "@/components/layout/HeaderStoreSwitcher";
import { Button } from "@/components/ui/button";
import { User, ShieldAlert, Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";

// LAZY LOADED PAGES - Reduces initial bundle size for faster login page
// Heavy pages with complex dependencies are loaded on-demand
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Sales = lazy(() => import("@/pages/sales"));
const Products = lazy(() => import("@/pages/products"));
const Customers = lazy(() => import("@/pages/customers"));
const Reports = lazy(() => import("@/pages/reports"));
const Inventory = lazy(() => import("@/pages/inventory"));
const Ledger = lazy(() => import("@/pages/ledger"));
const CustomerProfile = lazy(() => import("@/pages/customer-profile"));
const Staff = lazy(() => import("@/pages/staff"));
const Attendance = lazy(() => import("@/pages/attendance"));
const Expenses = lazy(() => import("@/pages/expenses"));
const Settings = lazy(() => import("@/pages/settings"));
const Kitchen = lazy(() => import("@/pages/kitchen"));
const CateringKitchen = lazy(() => import("@/pages/catering/kitchen"));
const CateringManager = lazy(() => import("@/pages/catering/manager"));
const DeliveryDashboard = lazy(() => import("@/pages/delivery-dashboard"));
const CateringPricingSettings = lazy(() => import("@/pages/settings/catering-pricing"));
const OrderHistoryPage = lazy(() => import("@/pages/order-history"));
const AIRecognizePage = lazy(() => import("@/pages/ai-recognize").then(m => ({ default: m.AIRecognizePage })));
const AdminTracking = lazy(() => import("@/pages/admin/tracking"));

// PUBLIC PAGES - Loaded directly for immediate access (no auth required)
import LunchMenu from "@/pages/lunch-menu";
import DeliveryApp from "@/pages/delivery-app";
import CateringDeliveryApp from "@/pages/catering-delivery";
import PublicMenu from "@/pages/public-menu";
import { InstallPWAButton } from "@/components/InstallPWAButton";
import { CustomerLayout } from "@/layouts/CustomerLayout";

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex h-full w-full items-center justify-center min-h-[200px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}


function RedirectHome() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/");
  }, [setLocation]);
  return null;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Helper function to guard routes */}
        {(() => {
          const { currentStaff } = useAuth();
          const isCustomer = (currentStaff?.role as any) === 'customer';

          if (isCustomer) {
            return (
              <>
                <Route path="/my-profile" component={CustomerProfile} />
                <Route path="/my-orders" component={OrderHistoryPage} />
                {/* Redirect any other attempt to menu or 404 */}
                <Route path="/lunch-menu" component={LunchMenu} />
                <Route component={RedirectHome} />
              </>
            );
          }

          // Admin/Staff Routes
          return (
            <>
              <Route path="/" component={Dashboard} />
              <Route path="/sales" component={Sales} />
              <Route path="/products" component={Products} />
              <Route path="/inventory" component={Inventory} />
              <Route path="/customers/:id" component={CustomerProfile} />
              <Route path="/customers" component={Customers} />
              <Route path="/ledger" component={Ledger} />
              <Route path="/kitchen" component={Kitchen} />
              <Route path="/catering/kitchen" component={CateringKitchen} />
              <Route path="/catering/orders" component={CateringManager} />
              <Route path="/delivery-dashboard" component={DeliveryDashboard} />
              <Route path="/admin/tracking" component={AdminTracking} />
              <Route path="/delivery" component={DeliveryApp} />
              <Route path="/reports" component={Reports} />
              <Route path="/staff" component={Staff} />
              <Route path="/attendance" component={Attendance} />
              <Route path="/expenses" component={Expenses} />
              <Route path="/settings" component={Settings} />
              <Route path="/backup" component={lazy(() => import("@/pages/backup"))} />
              <Route path="/settings/catering-pricing" component={CateringPricingSettings} />
              <Route path="/recognize" component={AIRecognizePage} />
              <Route component={RedirectHome} />
            </>
          );
        })()}
      </Switch>
    </Suspense>
  );
}

function AppHeader() {
  const { currentStaff, isLoggedIn } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between gap-4 px-3 py-2 md:px-4 md:py-3 border-b border-border bg-background sticky top-0 z-50">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <div className="flex-1 flex justify-center">
          <HeaderStoreSwitcher />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLoginOpen(true)}
            className="gap-2"
            data-testid="button-switch-user"
          >
            <User className="h-4 w-4" />
            {isLoggedIn ? (
              <span className="hidden sm:inline">{currentStaff?.name}</span>
            ) : (
              <span className="hidden sm:inline">Login</span>
            )}
          </Button>
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}

function ProtectedApp() {
  const { isLoggedIn, currentStaff } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [location, setLocation] = useLocation();

  // Check if app is running in standalone PWA mode
  type NavigatorWithStandalone = Navigator & { standalone?: boolean };
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as NavigatorWithStandalone).standalone ||
    document.referrer.includes('android-app://');

  // Force login modal on startup if not authenticated
  useEffect(() => {
    // Safety Exception: Do not enforce login on public pages if routing fell through
    const path = window.location.pathname.replace(/\/$/, "");
    if (path === '/lunch-menu' || path === '/delivery-app' || path === '/delivery' || path.startsWith('/order/')) return;

    // Always show login screen if not logged in, regardless of PWA mode
    if (!isLoggedIn) {
      setLoginOpen(true);
    } else {
      setLoginOpen(false);
    }
  }, [isLoggedIn]);

  // Additional PWA-specific check
  useEffect(() => {
    if (isStandalone && !isLoggedIn) {
      // In PWA mode, ensure we're at root for login
      setLocation('/');
      setLoginOpen(true);
    }
  }, [isStandalone, isLoggedIn, setLocation]);

  // Handle successful login
  const handleLoginSuccess = () => {
    setLoginOpen(false);
    if (currentStaff?.role === 'kitchen') {
      setLocation('/kitchen');
    } else if (currentStaff?.role === 'cashier') {
      setLocation('/sales');
    } else {
      setLocation('/'); // Redirect to dashboard
    }
  };

  // Kitchen role guard: force kitchen staff to stay on Kitchen view
  useEffect(() => {
    if (!isLoggedIn) return;
    if (currentStaff?.role !== 'kitchen') return;

    if (location !== '/kitchen') {
      setLocation('/kitchen');
    }
  }, [isLoggedIn, currentStaff?.role, location, setLocation]);

  // Block access to content if not logged in
  if (!isLoggedIn) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <ShieldAlert className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Authentication Required
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Please log in with your staff credentials to access Agart POS System
          </p>
          <LoginModal
            open={loginOpen}
            onOpenChange={setLoginOpen}
            onSuccess={handleLoginSuccess}
            required={true}
          />
        </div>
      </div>
    );
  }

  // Customer Layout - Strictly Separated from Admin


  const style = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <AppHeader />
          <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900/50">
            <Router />
          </main>
        </div>
      </div>
      {/* PWA Install Banner - shows on mobile when install is available */}
      <InstallPWAButton variant="banner" />
    </SidebarProvider>
  );
}

// Check public routes BEFORE any React hooks to ensure immediate routing
// Check public routes BEFORE any React hooks to ensure immediate routing
function getPublicRoute(): 'lunch-menu' | 'delivery-app' | 'delivery' | 'order' | 'customer-profile' | 'my-orders' | null {
  // Normalize path only for equality check (handle trailing slashes)
  const path = window.location.pathname.replace(/\/$/, "");

  if (path === '/lunch-menu') return 'lunch-menu';
  if (path === '/delivery-app') return 'delivery-app';
  if (path === '/delivery') return 'delivery'; // New Catering Rider App
  if (path === '/my-orders') return 'my-orders'; // Customer Order History

  // Customer Profile Aliases
  if (path === '/my-profile') return 'customer-profile';
  if (path === '/profile') return 'customer-profile';
  if (path === '/my-account') return 'customer-profile';

  if (path.startsWith('/order/')) return 'order';
  return null;
}

function App() {
  // Device detection: Check if running on mobile device
  const isMobile = typeof window !== 'undefined' && (
    window.innerWidth <= 768 || // Screen width check
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    ('ontouchstart' in window && navigator.maxTouchPoints > 0) // Touch capability
  );

  // PWA REDIRECT: Only redirect MOBILE PWA users to delivery app
  // Desktop PWA users should stay on Dashboard/POS
  const isPWA = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone
  );
  const path = window.location.pathname.replace(/\/$/, "") || "/";

  // Only redirect to /delivery if:
  // 1. Running as PWA (standalone mode)
  // 2. On a MOBILE device
  // 3. On root path or login page
  if (isPWA && isMobile && (path === "/" || path === "" || path === "/login")) {
    console.log("📱 Mobile PWA detected on root - Redirecting to /delivery");
    window.location.href = "/delivery";
    return null; // Return early while redirecting
  }

  // Desktop PWA: Stay on dashboard, do NOT redirect
  if (isPWA && !isMobile && (path === "/" || path === "")) {
    console.log("🖥️ Desktop PWA detected - Staying on Dashboard");
    // No redirect needed, just continue to protected app
  }

  // CRITICAL: Check window.location.pathname FIRST before any hooks
  // This ensures public routes render immediately without any auth checks
  const publicRoute = getPublicRoute();

  // PUBLIC ROUTE: Lunch Menu (QR Table Ordering) - NO AUTH REQUIRED
  if (publicRoute === 'lunch-menu') {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LunchMenu />
          <InstallPWAButton variant="banner" />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // PUBLIC ROUTE: Delivery App (Old Restaurant Rider App) - NO AUTH REQUIRED
  if (publicRoute === 'delivery-app') {
    console.log("📱 Public Route: /delivery-app - Rendering DeliveryApp directly");
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <DeliveryApp />
          <InstallPWAButton variant="banner" />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // PUBLIC ROUTE: Catering Delivery (New Catering Rider App) - NO AUTH REQUIRED
  if (publicRoute === 'delivery') {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <CateringDeliveryApp />
          <InstallPWAButton variant="banner" />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // CUSTOMER ROUTE: Profile & History - Uses CustomerLayout + Internal Auth Check
  if (publicRoute === 'customer-profile') {
    return (
      <Suspense fallback={<PageLoader />}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <CustomerLayout>
              <Route path="/my-profile" component={CustomerProfile} />
              <Route path="/profile" component={CustomerProfile} />
              <Route path="/my-account" component={CustomerProfile} />
            </CustomerLayout>
            <InstallPWAButton variant="banner" />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </Suspense>
    );
  }

  // CUSTOMER ROUTE: My Orders
  if (publicRoute === 'my-orders') {
    return (
      <Suspense fallback={<PageLoader />}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <CustomerLayout>
              <Route path="/my-orders" component={OrderHistoryPage} />
            </CustomerLayout>
            <InstallPWAButton variant="banner" />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </Suspense>
    );
  }

  // PUBLIC ROUTE: Dedicated Order Page (Table QR) - NO AUTH REQUIRED
  if (publicRoute === 'order') {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {/* Direct Route for order/:tableId */}
          <Route path="/order/:tableId" component={PublicMenu} />
          <InstallPWAButton variant="banner" />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // PROTECTED ROUTES: Require authentication
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BusinessModeProvider>
          <AuthProvider>
            <ProtectedApp />
          </AuthProvider>
        </BusinessModeProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
