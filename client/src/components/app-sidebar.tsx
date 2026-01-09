import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, ShoppingCart, Package, Users, BarChart3, Boxes, Receipt, UserCog, ClipboardList, Wallet, Camera, Settings } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { ShiftButton } from "@/components/shift-button";
import { ShiftManagement } from "@/components/shift-management";
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

  const currentRole = currentStaff?.role || "cashier";

  const canAccess = (roles: StaffRole[]) => {
    if (!isLoggedIn) return true;
    return roles.includes(currentRole);
  };

  const filteredNavItems = navItems.filter(item => canAccess(item.roles));
  const filteredAdminItems = adminItems.filter(item => canAccess(item.roles));

  return (
    <Sidebar>
      <SidebarHeader className="p-4 md:p-5 border-b border-sidebar-border">
        <Link href="/" data-testid="link-home">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600">
              <ShoppingCart className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold text-sidebar-foreground">{t('app.name')}</span>
              <span className="text-[10px] text-muted-foreground">{t('app.tagline')}</span>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="py-2.5 px-3"
                    >
                      <Link href={item.url} data-testid={`link-${t(item.titleKey).toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')}`}>
                        <item.icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{t(item.titleKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {filteredAdminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-3 text-xs text-muted-foreground">Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredAdminItems.map((item) => {
                  const isActive = location === item.url;
                  return (
                    <SidebarMenuItem key={item.titleKey}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="py-2.5 px-3"
                      >
                        <Link href={item.url} data-testid={`link-${t(item.titleKey).toLowerCase()}`}>
                          <item.icon className="w-4 h-4" />
                          <span className="text-sm font-medium">{t(item.titleKey)}</span>
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
        <div className="px-3 py-2">
          <ShiftManagement className="w-full" />
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
