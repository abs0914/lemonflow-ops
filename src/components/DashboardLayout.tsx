import { ReactNode } from "react";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

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
    <>
      {/* Backdrop overlay - only visible on mobile when sidebar is open */}
      {isMobile && openMobile && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setOpenMobile(false)}
        />
      )}
      
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main 
          className="flex-1 overflow-auto relative z-10 p-6"
          onClick={handleMainContentClick}
        >
          {children}
        </main>
      </div>
    </>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </SidebarProvider>
  );
}
