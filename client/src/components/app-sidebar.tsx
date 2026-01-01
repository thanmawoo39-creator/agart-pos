import { Link, useLocation } from "wouter";
import { LayoutDashboard, ShoppingCart, Package, Users, BarChart3, Boxes, Receipt, UserCog, ClipboardList, Wallet } from "lucide-react";
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
import type { StaffRole } from "@shared/schema";

interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  roles: StaffRole[];
}

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["owner", "manager"] },
  { title: "Sales (POS)", url: "/sales", icon: ShoppingCart, roles: ["owner", "manager", "cashier"] },
  { title: "Inventory", url: "/inventory", icon: Boxes, roles: ["owner", "manager"] },
  { title: "Customers", url: "/customers", icon: Users, roles: ["owner", "manager", "cashier"] },
  { title: "Ledger", url: "/ledger", icon: Receipt, roles: ["owner", "manager"] },
  { title: "Reports", url: "/reports", icon: BarChart3, roles: ["owner", "manager"] },
];

const adminItems: NavItem[] = [
  { title: "Expenses", url: "/expenses", icon: Wallet, roles: ["owner"] },
  { title: "Staff", url: "/staff", icon: UserCog, roles: ["owner"] },
  { title: "Attendance", url: "/attendance", icon: ClipboardList, roles: ["owner"] },
];

export function AppSidebar() {
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
              <span className="text-base font-semibold text-sidebar-foreground">QuickPOS</span>
              <span className="text-[10px] text-muted-foreground">Point of Sale</span>
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
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="py-2.5 px-3"
                    >
                      <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')}`}>
                        <item.icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{item.title}</span>
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
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="py-2.5 px-3"
                      >
                        <Link href={item.url} data-testid={`link-${item.title.toLowerCase()}`}>
                          <item.icon className="w-4 h-4" />
                          <span className="text-sm font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
