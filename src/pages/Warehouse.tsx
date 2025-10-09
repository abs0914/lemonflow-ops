import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, AlertCircle, Clock, Plus, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { StockReceiptForm } from "@/components/warehouse/StockReceiptForm";
import { RecentReceipts } from "@/components/warehouse/RecentReceipts";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { ActionSheet } from "@/components/ui/action-sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Warehouse() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [receiptSheetOpen, setReceiptSheetOpen] = useState(false);

  useEffect(() => {
    if (!loading && !profile) {
      navigate("/login");
    }
    if (!loading && profile && !["Admin", "Warehouse"].includes(profile.role)) {
      navigate("/dashboard");
    }
  }, [profile, loading, navigate]);

  // Fetch warehouse KPIs
  const { data: kpis, refetch: refetchKpis } = useQuery({
    queryKey: ["warehouse-kpis"],
    queryFn: async () => {
      // Total components count
      const { count: componentsCount } = await supabase
        .from("components")
        .select("*", { count: "exact", head: true });

      // Low stock count (available stock < 10)
      const { data: components } = await supabase
        .from("components")
        .select("stock_quantity, reserved_quantity");
      
      const lowStockCount = components?.filter(
        c => (c.stock_quantity - c.reserved_quantity) < 10
      ).length || 0;

      // Pending AutoCount syncs
      const { count: pendingSyncs } = await supabase
        .from("stock_movements")
        .select("*", { count: "exact", head: true })
        .eq("autocount_synced", false);

      return {
        totalComponents: componentsCount || 0,
        lowStockAlerts: lowStockCount,
        pendingSyncs: pendingSyncs || 0,
      };
    },
  });

  if (loading || !profile) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-6 md:space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Warehouse Management</h1>
          <p className="text-muted-foreground mt-2">
            Receive stock, track inventory, and manage warehouse operations
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Components</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis?.totalComponents || 0}</div>
              <p className="text-xs text-muted-foreground">Raw materials in inventory</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
              <AlertCircle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{kpis?.lowStockAlerts || 0}</div>
              <p className="text-xs text-muted-foreground">Components below threshold</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending AutoCount Sync</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis?.pendingSyncs || 0}</div>
              <p className="text-xs text-muted-foreground">Stock movements to sync</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="receive" className="space-y-4">
          <TabsList>
            <TabsTrigger value="receive">Receive Stock</TabsTrigger>
            <TabsTrigger value="receipts">Recent Receipts</TabsTrigger>
          </TabsList>

          <TabsContent value="receive" className="space-y-4">
            {isMobile ? (
              <ActionSheet
                open={receiptSheetOpen}
                onOpenChange={setReceiptSheetOpen}
                title="Stock Receipt"
                description="Record incoming stock from suppliers"
              >
                <StockReceiptForm />
              </ActionSheet>
            ) : (
              <StockReceiptForm />
            )}
          </TabsContent>

          <TabsContent value="receipts" className="space-y-4">
            <RecentReceipts />
          </TabsContent>
        </Tabs>
      </div>

      {/* Mobile FAB */}
      {isMobile && (
        <FloatingActionButton
          icon={Plus}
          label="Quick Actions"
          actions={[
            {
              icon: Plus,
              label: "Receive Stock",
              onClick: () => setReceiptSheetOpen(true),
            },
            {
              icon: RefreshCw,
              label: "Refresh",
              onClick: () => refetchKpis(),
            },
          ]}
        />
      )}
    </DashboardLayout>
  );
}
