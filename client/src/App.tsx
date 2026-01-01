import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LoginModal } from "@/components/login-modal";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
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
      <Route path="/reports" component={Reports} />
      <Route path="/staff" component={Staff} />
      <Route path="/attendance" component={Attendance} />
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
          <ThemeToggle />
        </div>
      </header>
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}

function App() {
  const style = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
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
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
