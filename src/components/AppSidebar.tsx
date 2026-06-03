import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  Factory, 
  Barcode, 
  Warehouse,
  Store,
  Database,
  Users,
  User,
  UserCheck,
  ShoppingCart,
  Settings as SettingsIcon,
  CheckCircle,
  LogOut,
  ShoppingBag,
  ClipboardList,
  BarChart3,
  DollarSign,
  ChevronRight,
  Plus,
  ClipboardPaste,
  List,
  Truck,
  RefreshCw
} from "lucide-react";
import tlcLogo from "@/assets/tlc-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AutoSyncStatusIndicator } from "@/components/AutoSyncStatusIndicator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { useAllUserStores } from "@/hooks/useUserStore";
import { NotificationBell } from "./NotificationBell";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  subItems?: { title: string; url: string; icon: React.ComponentType<{ className?: string }> }[];
}

export function AppSidebar() {
  const { profile, loading, signOut } = useAuth();
  const { data: userStores } = useAllUserStores();
  const location = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const isFranchiseeOnly =
    profile?.role === "Store" &&
    !!userStores?.length &&
    userStores.every((s) => s.stores?.store_type === "franchisee");

  const menuItems: MenuItem[] = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      roles: ["Admin", "CEO", "Production", "Warehouse", "Fulfillment", "Accounting"],
    },
    {
      title: "BOM Manager",
      url: "/bom",
      icon: Package,
      roles: ["Admin", "Warehouse", "Fulfillment", "Production"],
    },
    {
      title: "Production",
      url: "/production",
      icon: Factory,
      roles: ["Admin", "Production", "Warehouse", "Fulfillment"],
    },
    {
      title: "Raw Materials",
      url: "/raw-materials",
      icon: Package,
      roles: ["Admin", "Warehouse"],
    },
    {
      title: "Inventory",
      url: "/inventory",
      icon: Database,
      roles: ["Admin", "Warehouse", "Fulfillment", "Production", "Accounting"],
    },
    {
      title: "Suppliers",
      url: "/suppliers",
      icon: Users,
      roles: ["Admin", "Warehouse", "Production"],
    },
    {
      title: "Stores",
      url: "/stores",
      icon: Store,
      roles: ["Admin", "Warehouse", "Production", "Fulfillment", "Finance"],
    },
    {
      title: "Purchasing",
      url: "/purchasing",
      icon: ShoppingCart,
      roles: ["Admin", "CEO", "Warehouse", "Finance", "Accounting"],
    },
    {
      title: "Receiving Report",
      url: "/incoming-inventory",
      icon: Truck,
      roles: ["Admin", "Warehouse", "Fulfillment", "Production", "Accounting"],
    },
    {
      title: "Store Orders",
      url: "/store/orders",
      icon: ShoppingBag,
      roles: ["Admin", "Store", "Warehouse", "Fulfillment", "Production", "Accounting", "Finance"],
      subItems: [
        { title: "All Orders", url: "/store/orders", icon: List },
        { title: "New Order", url: "/store/orders/create", icon: Plus },
        { title: "Quick Entry", url: "/store/orders/quick-entry", icon: ClipboardPaste },
      ],
    },
    {
      title: "Fulfillment",
      url: "/fulfillment",
      icon: ClipboardList,
      roles: ["Admin", "Fulfillment", "Warehouse", "Production", "Finance", "Accounting"],
    },
    {
      title: "Finance",
      url: "/finance",
      icon: DollarSign,
      roles: ["Admin", "Finance", "Accounting"],
    },
    {
      title: "Accounting",
      url: "/accounting",
      icon: ClipboardList,
      roles: ["Admin", "Accounting"],
    },
    {
      title: "CEO Approvals",
      url: "/ceo-dashboard",
      icon: CheckCircle,
      roles: ["Admin", "CEO"],
    },
    {
      title: "Reports",
      url: "/reports",
      icon: BarChart3,
      roles: ["Admin", "CEO", "Production", "Warehouse", "Store", "Fulfillment", "Accounting"],
    },
    {
      title: "Settings",
      url: "/settings",
      icon: SettingsIcon,
      roles: ["Admin"],
    },
    {
      title: "My Account",
      url: "/my-account",
      icon: User,
      roles: ["Store", "Admin", "CEO", "Finance", "Production", "Warehouse", "Fulfillment", "Accounting"],
    },
  ];

  const normalizedRole = profile?.role?.trim();
  const filteredItems = menuItems.filter((item) =>
    item.roles.includes(normalizedRole || "")
  );

  const isActive = (path: string) => location.pathname === path;
  const isSubActive = (item: MenuItem) => 
    item.subItems?.some(sub => location.pathname === sub.url) || location.pathname === item.url;

  const handleNavClick = () => {
    if (isMobile) {
      setTimeout(() => setOpenMobile(false), 50);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className={`flex items-center gap-2 py-3 ${state === "expanded" ? "px-2" : "justify-center px-1"}`}>
          <img 
            src={tlcLogo} 
            alt="The Lemon Co Logo" 
            className={`rounded-lg ${state === "expanded" ? "h-10 w-10" : "h-8 w-8"}`}
          />
          {state === "expanded" && (
            <div className="flex flex-col flex-1">
              <span className="text-lg font-bold text-sidebar-foreground">
                The Lemon Co
              </span>
              <span className="text-xs text-sidebar-foreground/60">
                Production System
              </span>
            </div>
          )}
          <NotificationBell />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {profile && state === "expanded" && (
          <div className="px-3 py-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-sidebar-foreground">
                {profile.full_name}
              </span>
              <Badge 
                variant="outline" 
                className="w-fit bg-sidebar-accent/50 text-sidebar-foreground border-sidebar-border"
              >
                {profile.role}
              </Badge>
            </div>
          </div>
        )}
        
        <Separator className="bg-sidebar-border" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">
            {state === "expanded" ? "Main Menu" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {loading && (
                <div className="px-2 py-2 text-xs text-sidebar-foreground/70">Loading menu...</div>
              )}
              {!loading && profile && filteredItems.length === 0 && (
                <div className="px-2 py-2 text-xs text-sidebar-foreground/70">No menu items for this role.</div>
              )}
              {!loading && filteredItems.map((item) => 
                item.subItems ? (
                  <Collapsible
                    key={item.title}
                    asChild
                    defaultOpen={isSubActive(item)}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={isSubActive(item)}
                          className={isSubActive(item) 
                            ? "bg-sidebar-accent text-sidebar-primary font-semibold" 
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                          }
                        >
                          <item.icon className="h-4 w-4" />
                          {state === "expanded" && <span>{item.title}</span>}
                          {state === "expanded" && (
                            <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.subItems.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild>
                                <NavLink
                                  to={subItem.url}
                                  onClick={handleNavClick}
                                  className={({ isActive }) =>
                                    isActive
                                      ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                                  }
                                >
                                  <subItem.icon className="h-4 w-4" />
                                  <span>{subItem.title}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                    >
                      <NavLink 
                        to={item.url}
                        onClick={handleNavClick}
                        className={({ isActive }) => 
                          isActive 
                            ? "bg-sidebar-accent text-sidebar-primary font-semibold" 
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                        }
                      >
                        <item.icon className="h-4 w-4" />
                        {state === "expanded" && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-1 space-y-1">
        {profile?.role === "Admin" && state === "expanded" && (
          <div className="px-1">
            <AutoSyncStatusIndicator />
          </div>
        )}
        {state === "expanded" ? (
          <div className="flex items-center gap-1">
            <SidebarTrigger />
            <Button
              onClick={signOut}
              variant="ghost"
              size="sm"
              className="flex-1 justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary h-8"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <SidebarTrigger />
            <Button
              onClick={signOut}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}