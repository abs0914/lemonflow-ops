import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import tlcLogo from "@/assets/tlc-logo.png";
interface DashboardLayoutProps {
  children: ReactNode;
}

function DashboardLayoutInner({ children }: DashboardLayoutProps) {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

  const handleMainContentClick = () => {
    if (isMobile && openMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Mobile header with sidebar trigger */}
        {isMobile && (
          <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-background px-3 md:hidden">
            <SidebarTrigger />
            <img src={tlcLogo} alt="The Lemon Co" className="h-7 w-7 rounded-lg" />
            <span className="text-sm font-semibold text-foreground">The Lemon Co</span>
          </header>
        )}
        <main 
          className="flex-1 p-6"
          onClick={handleMainContentClick}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </SidebarProvider>
  );
}
