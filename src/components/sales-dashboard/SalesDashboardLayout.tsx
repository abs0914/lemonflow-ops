import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BarChart3,
  Store,
  ArrowLeft,
  Citrus,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/sales-dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sales-dashboard/reports", label: "Reports", icon: BarChart3 },
  { href: "/sales-dashboard/stores", label: "Stores", icon: Store },
];

export function SalesDashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleBackToMain = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-primary h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Citrus className="h-6 w-6 text-primary-foreground" />
          <span className="font-bold text-primary-foreground">Lemon-co Sales</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-primary-foreground hover:bg-primary/80"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-64 bg-primary transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center gap-3 px-6 border-b border-primary-foreground/10">
            <Citrus className="h-8 w-8 text-primary-foreground" />
            <span className="font-bold text-xl text-primary-foreground">Lemon-co</span>
          </div>

          {/* User Info */}
          <div className="px-6 py-3 border-b border-primary-foreground/10">
            <p className="text-sm text-primary-foreground/70">Logged in as</p>
            <p className="font-medium text-primary-foreground truncate">
              {profile?.full_name || "User"}
            </p>
            <p className="text-xs text-primary-foreground/60">{profile?.role}</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    isActive
                      ? "bg-primary-foreground text-primary font-medium"
                      : "text-primary-foreground/80 hover:bg-primary-foreground/10"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Back to Main App */}
          <div className="p-4 border-t border-primary-foreground/10">
            <Button
              variant="ghost"
              className="w-full justify-start text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={handleBackToMain}
            >
              <ArrowLeft className="h-5 w-5 mr-3" />
              Back to Main App
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 pt-14 lg:pt-0">
        <div className="p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
}
