import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Boxes,
  Receipt,
  UserCog,
  ClipboardList,
  Wallet,
  Camera,
  Settings,
  ChefHat,
  Store
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { ShiftButton } from "@/components/shift-button";
import { ShiftManagement } from "@/components/shift-management";
import { useBusinessMode } from "@/contexts/BusinessModeContext";
import { API_BASE_URL } from "@/lib/api-config";
import type { StaffRole } from "@shared/schema";

interface NavItem {
  titleKey: string;
  url: string;
  icon: typeof LayoutDashboard;
  roles: StaffRole[];
}

const navItems: NavItem[] = [
  { titleKey: "navigation.dashboard", url: "/", icon: LayoutDashboard, roles: ["owner", "manager"] },
  { titleKey: "navigation.sales", url: "/sales", icon: ShoppingCart, roles: ["owner", "manager", "cashier"] },
  { titleKey: "navigation.kitchen", url: "/kitchen", icon: ChefHat, roles: ["owner", "manager", "cashier", "kitchen"] },
  { titleKey: "navigation.inventory", url: "/inventory", icon: Boxes, roles: ["owner", "manager"] },
  { titleKey: "navigation.customers", url: "/customers", icon: Users, roles: ["owner", "manager", "cashier"] },
  { titleKey: "navigation.ledger", url: "/ledger", icon: Receipt, roles: ["owner", "manager"] },
  { titleKey: "navigation.reports", url: "/reports", icon: BarChart3, roles: ["owner", "manager"] },
  { titleKey: "navigation.recognize", url: "/recognize", icon: Camera, roles: ["owner", "manager", "cashier"] },
];

const adminItems: NavItem[] = [
  { titleKey: "navigation.expenses", url: "/expenses", icon: Wallet, roles: ["owner"] },
  { titleKey: "navigation.staff", url: "/staff", icon: UserCog, roles: ["owner"] },
  { titleKey: "navigation.attendance", url: "/attendance", icon: ClipboardList, roles: ["owner"] },
  { titleKey: "navigation.settings", url: "/settings", icon: Settings, roles: ["owner"] },
];

export function AppSidebar() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const { currentStaff, isLoggedIn, isOwner } = useAuth();
  const { setOpen, setOpenMobile, isMobile, state } = useSidebar();

  const { businessUnit } = useBusinessMode();
  const { data: businessUnits = [] } = useQuery<any[]>({
    queryKey: ['/api/business-units'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/business-units`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch business units');
      return response.json();
    },
  });

  const currentRole = currentStaff?.role || "cashier";

  const canAccess = (roles: StaffRole[]) => {
    if (!isLoggedIn) return true;
    return roles.includes(currentRole);
  };

  // Handle navigation click - close sidebar on mobile
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false); // Close mobile sidebar
    }
  };

  const filteredNavItems = navItems.filter(item => canAccess(item.roles));
  const filteredAdminItems = adminItems.filter(item => canAccess(item.roles));

  const activeBusinessUnit = businessUnits.find((u: any) => u.id === businessUnit) || null;
  const activeTypeRaw = (activeBusinessUnit as any)?.type;
  const activeType = typeof activeTypeRaw === 'string' ? activeTypeRaw.toLowerCase() : '';
  const isRestaurant = activeType === 'restaurant';
  const isKitchenOrWaiter = currentRole === 'kitchen' || (currentRole as any) === 'waiter';

  const dynamicNavItems = filteredNavItems.filter((item) => {
    if (item.url === '/kitchen' && !isRestaurant) return false;
    if (item.url === '/inventory' && isKitchenOrWaiter) return false;
    return true;
  });

  const dynamicAdminItems = filteredAdminItems.filter((item) => {
    if (item.url === '/settings' && isKitchenOrWaiter) return false;
    return true;
  });

  const kitchenOnlyNavItems = dynamicNavItems.filter((item) => item.url === '/kitchen');

  return (
    <Sidebar>
      <SidebarHeader className="p-4 md:p-5 border-b border-sidebar-border">
        <Link href={currentRole === 'kitchen' ? "/kitchen" : "/"} data-testid="link-home" onClick={handleNavClick}>
          <div className="flex items-center justify-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
              <img
                src="/favicon.png"
                alt="POS Logo"
                className="w-full h-full object-contain"
              />
            </div>
            {state === "expanded" && (
              <div className="flex flex-col">
                <span className="text-base font-semibold text-sidebar-foreground">{t('app.name')}</span>
                <span className="text-[10px] text-muted-foreground">{t('app.tagline')}</span>
              </div>
            )}
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {(currentRole === 'kitchen' ? kitchenOnlyNavItems : dynamicNavItems).map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`py-2.5 px-3 transition-all duration-200 ${isActive ? 'bg-primary/10 shadow-sm' : 'hover:bg-muted/50'}`}
                    >
                      <Link href={item.url} data-testid={`link-${t(item.titleKey).toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')}`} onClick={handleNavClick}>
                        <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={isActive ? 2.5 : 2} />
                        <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>{t(item.titleKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {dynamicAdminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {dynamicAdminItems.map((item) => {
                  const isActive = location === item.url;
                  return (
                    <SidebarMenuItem key={item.titleKey}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={`py-2.5 px-3 transition-all duration-200 ${isActive ? 'bg-primary/10 shadow-sm' : 'hover:bg-muted/50'}`}
                      >
                        <Link href={item.url} data-testid={`link-${t(item.titleKey).toLowerCase()}`} onClick={handleNavClick}>
                          <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={isActive ? 2.5 : 2} />
                          <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>{t(item.titleKey)}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Shift Management */}
        {currentRole !== 'kitchen' && (
          <div className="px-3 py-2">
            <ShiftManagement className="w-full" />
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
