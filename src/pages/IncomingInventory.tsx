import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PendingReceiptsList } from "@/components/inventory/PendingReceiptsList";
import { EnhancedGoodsReceivedForm } from "@/components/inventory/EnhancedGoodsReceivedForm";
import { ReceivingHistory } from "@/components/inventory/ReceivingHistory";
import { GoodsReturnForm } from "@/components/warehouse/GoodsReturnForm";
import { StockReceiptForm } from "@/components/warehouse/StockReceiptForm";
import { 
  Package, 
  ClipboardCheck, 
  Clock, 
  History,
  AlertCircle,
  Truck,
  PackageX,
  PackagePlus
} from "lucide-react";

export default function IncomingInventory() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pending");

  useEffect(() => {
    if (!loading && (!profile || !["Admin", "Warehouse", "Fulfillment", "Production"].includes(profile.role))) {
      navigate("/login");
    }
  }, [profile, loading, navigate]);

  // Fetch KPI data
  const { data: kpiData } = useQuery({
    queryKey: ["incoming-inventory-kpis"],
    queryFn: async () => {
      // Get pending POs (approved but not fully received)
      const { data: pendingPOs, error: poError } = await supabase
        .from("purchase_orders")
        .select("id")
        .eq("status", "approved")
        .or("goods_received.is.null,goods_received.eq.false");

      if (poError) throw poError;

      // Get today's receipts count
      const today = new Date().toISOString().split("T")[0];
      const { count: todayReceipts, error: todayError } = await supabase
        .from("stock_movements")
        .select("*", { count: "exact", head: true })
        .eq("movement_type", "receipt")
        .gte("created_at", `${today}T00:00:00`);

      if (todayError) throw todayError;

      // Get pending AutoCount syncs
      const { count: pendingSyncs, error: syncError } = await supabase
        .from("stock_movements")
        .select("*", { count: "exact", head: true })
        .eq("movement_type", "receipt")
        .or("autocount_synced.is.null,autocount_synced.eq.false");

      if (syncError) throw syncError;

      // Get total pending line items
      const { data: pendingLines, error: linesError } = await supabase
        .from("purchase_order_lines")
        .select(`
          id,
          purchase_orders!inner(status, goods_received)
        `)
        .eq("purchase_orders.status", "approved");

      if (linesError) throw linesError;

      return {
        pendingPOs: pendingPOs?.length || 0,
        pendingItems: pendingLines?.length || 0,
        todayReceipts: todayReceipts || 0,
        pendingSyncs: pendingSyncs || 0,
      };
    },
  });

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Truck className="h-7 w-7 text-primary" />
            Incoming Inventory
          </h1>
          <p className="text-muted-foreground mt-1">
            Centralized management for receiving goods, returns, and direct receipts
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending POs</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiData?.pendingPOs || 0}</div>
              <p className="text-xs text-muted-foreground">Awaiting goods</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiData?.pendingItems || 0}</div>
              <p className="text-xs text-muted-foreground">Line items to receive</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Receipts</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{kpiData?.todayReceipts || 0}</div>
              <p className="text-xs text-muted-foreground">Items received today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Syncs</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{kpiData?.pendingSyncs || 0}</div>
              <p className="text-xs text-muted-foreground">AutoCount sync pending</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="pending" className="flex items-center gap-1 text-xs sm:text-sm">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Pending</span>
              {kpiData?.pendingPOs ? (
                <Badge variant="secondary" className="ml-1 hidden lg:inline-flex">
                  {kpiData.pendingPOs}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="receive" className="flex items-center gap-1 text-xs sm:text-sm">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Receive</span>
            </TabsTrigger>
            <TabsTrigger value="direct" className="flex items-center gap-1 text-xs sm:text-sm">
              <PackagePlus className="h-4 w-4" />
              <span className="hidden sm:inline">Direct</span>
            </TabsTrigger>
            <TabsTrigger value="return" className="flex items-center gap-1 text-xs sm:text-sm">
              <PackageX className="h-4 w-4" />
              <span className="hidden sm:inline">Return</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1 text-xs sm:text-sm">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            <PendingReceiptsList onReceive={(poId) => {
              setActiveTab("receive");
            }} />
          </TabsContent>

          <TabsContent value="receive" className="space-y-4">
            <EnhancedGoodsReceivedForm />
          </TabsContent>

          <TabsContent value="direct" className="space-y-4">
            <StockReceiptForm />
          </TabsContent>

          <TabsContent value="return" className="space-y-4">
            <GoodsReturnForm />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <ReceivingHistory />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
