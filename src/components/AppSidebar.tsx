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
  LogOut
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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";

export function AppSidebar() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();

  const menuItems = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      roles: ["Admin", "CEO", "Production", "Warehouse"],
    },
    {
      title: "BOM Manager",
      url: "/bom",
      icon: Package,
      roles: ["Admin"],
    },
    {
      title: "Production",
      url: "/production",
      icon: Factory,
      roles: ["Admin", "Production"],
    },
    {
      title: "Commissary",
      url: "/warehouse",
      icon: Warehouse,
      roles: ["Admin", "Warehouse"],
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
      roles: ["Admin", "Warehouse"],
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
      roles: ["Admin", "CEO", "Warehouse"],
    },
    {
      title: "CEO Approvals",
      url: "/ceo-dashboard",
      icon: CheckCircle,
      roles: ["CEO"],
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
              {filteredItems.map((item) => (
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
              ))}
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
