import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  Factory, 
  Barcode, 
  Warehouse,
  Database,
  Users,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  subItems?: { title: string; url: string; icon: React.ComponentType<{ className?: string }> }[];
}

export function AppSidebar() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();

  const menuItems: MenuItem[] = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      roles: ["Admin", "CEO", "Production", "Warehouse", "Fulfillment"],
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
      roles: ["Admin", "Warehouse", "Fulfillment", "Production"],
    },
    {
      title: "Suppliers",
      url: "/suppliers",
      icon: Users,
      roles: ["Admin", "Warehouse"],
    },
    {
      title: "Purchasing",
      url: "/purchasing",
      icon: ShoppingCart,
      roles: ["Admin", "CEO", "Warehouse", "Finance"],
    },
    {
      title: "Incoming Inventory",
      url: "/incoming-inventory",
      icon: Truck,
      roles: ["Admin", "Warehouse", "Fulfillment", "Production"],
    },
    {
      title: "Store Orders",
      url: "/store/orders",
      icon: ShoppingBag,
      roles: ["Admin", "Store", "Warehouse", "Fulfillment", "Production"],
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
      roles: ["Admin", "Fulfillment", "Warehouse", "Production"],
    },
    {
      title: "Finance",
      url: "/finance",
      icon: DollarSign,
      roles: ["Admin", "Finance"],
    },
    {
      title: "CEO Approvals",
      url: "/ceo-dashboard",
      icon: CheckCircle,
      roles: ["CEO"],
    },
    {
      title: "Reports",
      url: "/reports",
      icon: BarChart3,
      roles: ["Admin", "CEO", "Production", "Warehouse", "Store", "Fulfillment"],
    },
    {
      title: "Sync Monitor",
      url: "/sync-monitor",
      icon: RefreshCw,
      roles: ["Admin"],
    },
    {
      title: "Settings",
      url: "/settings",
      icon: SettingsIcon,
      roles: ["Admin"],
    },
  ];

  const filteredItems = menuItems.filter((item) =>
    item.roles.includes(profile?.role || "")
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
        <div className="flex items-center gap-2 px-2 py-4">
          <img 
            src={tlcLogo} 
            alt="The Lemon Co Logo" 
            className="h-10 w-10 rounded-lg"
          />
          {state === "expanded" && (
            <div className="flex flex-col">
              <span className="text-lg font-bold text-sidebar-foreground">
                The Lemon Co
              </span>
              <span className="text-xs text-sidebar-foreground/60">
                Production System
              </span>
            </div>
          )}
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
              {filteredItems.map((item) => 
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

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="p-2">
          <SidebarTrigger className="w-full" />
        </div>
        {state === "expanded" && (
          <div className="p-2">
            <Button
              onClick={signOut}
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-primary"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}