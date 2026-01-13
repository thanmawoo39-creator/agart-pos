import { useState, useEffect } from "react";
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
import { User, ShieldAlert } from "lucide-react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Sales from "@/pages/sales";
import Products from "@/pages/products";
import Customers from "@/pages/customers";
import Reports from "@/pages/reports";
import Inventory from "@/pages/inventory";
import Ledger from "@/pages/ledger";
import CustomerProfile from "@/pages/customer-profile";
import Staff from "@/pages/staff";
import Attendance from "@/pages/attendance";
import Expenses from "@/pages/expenses";
import Settings from "@/pages/settings";
import Kitchen from "@/pages/kitchen";
import { ImageRecognition } from "@/components/image-recognition";
import { AIRecognizePage } from "@/pages/ai-recognize";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/sales" component={Sales} />
      <Route path="/products" component={Products} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/customers/:id" component={CustomerProfile} />
      <Route path="/customers" component={Customers} />
      <Route path="/ledger" component={Ledger} />
      <Route path="/kitchen" component={Kitchen} />
      <Route path="/reports" component={Reports} />
      <Route path="/staff" component={Staff} />
      <Route path="/attendance" component={Attendance} />
      <Route path="/expenses" component={Expenses} />
      <Route path="/settings" component={Settings} />
      <Route path="/recognize" component={AIRecognizePage} />
      <Route component={NotFound} />
    </Switch>
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
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone ||
    document.referrer.includes('android-app://');

  // Force login modal on startup if not authenticated
  useEffect(() => {
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
    } else if (currentStaff?.role === 'cashier' || (currentStaff as any)?.role === 'waiter') {
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
    </SidebarProvider>
  );
}

function App() {
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
