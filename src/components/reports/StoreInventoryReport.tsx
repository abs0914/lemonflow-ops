import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ReportCard } from "./ReportCard";
import { StoreInventoryReportTable } from "./StoreInventoryReportTable";
import { ReportChart } from "./ReportChart";
import { Package, Hash, DollarSign, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";

interface StoreInventoryReportProps {
  dateRange: { from: Date; to: Date };
}

export function StoreInventoryReport({ dateRange }: StoreInventoryReportProps) {
  const { user } = useAuth();

  // Get user's assigned stores
  const { data: userStores } = useQuery({
    queryKey: ["user-stores-report", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_store_assignments")
        .select("store_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data.map((a) => a.store_id);
    },
    enabled: !!user?.id,
  });

  // Fetch sales orders with lines for the user's stores
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["store-inventory-report", dateRange.from, dateRange.to, userStores],
    queryFn: async () => {
      if (!userStores || userStores.length === 0) return { orders: [], lines: [] };

      const { data: orders, error: ordersError } = await supabase
        .from("sales_orders")
        .select(`
          id,
          order_number,
          status,
          total_amount,
          created_at,
          stores(store_name)
        `)
        .in("store_id", userStores)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) return { orders: [], lines: [] };

      const orderIds = orders.map((o) => o.id);
      const { data: lines, error: linesError } = await supabase
        .from("sales_order_lines")
        .select("*")
        .in("sales_order_id", orderIds);

      if (linesError) throw linesError;

      return { orders, lines: lines || [] };
    },
    enabled: !!userStores && userStores.length > 0,
  });

  const metrics = useMemo(() => {
    if (!ordersData) return null;

    const { orders, lines } = ordersData;
    const uniqueItems = new Set(lines.map((l) => l.item_code)).size;
    const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
    const totalValue = lines.reduce((sum, l) => sum + (l.sub_total || 0), 0);
    const pendingDeliveries = orders.filter(
      (o) => o.status !== "completed" && o.status !== "cancelled"
    ).length;

    const byStatus = orders.reduce((acc, o) => {
      acc[o.status || "unknown"] = (acc[o.status || "unknown"] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      uniqueItems,
      totalQuantity,
      totalValue,
      pendingDeliveries,
      byStatus,
    };
  }, [ordersData]);

  const statusChartData = useMemo(() => {
    if (!metrics?.byStatus) return [];
    return Object.entries(metrics.byStatus).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " "),
      value,
    }));
  }, [metrics]);

  const topItemsChartData = useMemo(() => {
    if (!ordersData?.lines) return [];

    const itemQuantities = ordersData.lines.reduce((acc, l) => {
      const key = l.item_name || l.item_code;
      acc[key] = (acc[key] || 0) + l.quantity;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(itemQuantities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({
        name: name.length > 15 ? name.substring(0, 15) + "..." : name,
        value,
      }));
  }, [ordersData]);

  // Aggregate data by item for table
  const tableData = useMemo(() => {
    if (!ordersData?.lines || !ordersData?.orders) return [];

    const orderMap = new Map(ordersData.orders.map((o) => [o.id, o]));

    const itemAggregates = ordersData.lines.reduce((acc, line) => {
      const key = line.item_code;
      if (!acc[key]) {
        acc[key] = {
          item_code: line.item_code,
          item_name: line.item_name,
          uom: line.uom || "pcs",
          total_quantity: 0,
          total_value: 0,
          order_ids: new Set<string>(),
        };
      }
      acc[key].total_quantity += line.quantity;
      acc[key].total_value += line.sub_total || 0;
      acc[key].order_ids.add(line.sales_order_id);
      return acc;
    }, {} as Record<string, { item_code: string; item_name: string; uom: string; total_quantity: number; total_value: number; order_ids: Set<string> }>);

    return Object.values(itemAggregates)
      .map((item) => ({
        item_code: item.item_code,
        item_name: item.item_name,
        uom: item.uom,
        total_quantity: item.total_quantity,
        order_count: item.order_ids.size,
        total_value: item.total_value,
      }))
      .sort((a, b) => b.total_quantity - a.total_quantity);
  }, [ordersData]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ReportCard
          title="Unique Items Ordered"
          value={metrics?.uniqueItems || 0}
          icon={Package}
        />
        <ReportCard
          title="Total Quantity Ordered"
          value={(metrics?.totalQuantity || 0).toLocaleString()}
          icon={Hash}
        />
        <ReportCard
          title="Total Order Value"
          value={`₱${(metrics?.totalValue || 0).toLocaleString()}`}
          icon={DollarSign}
        />
        <ReportCard
          title="Pending Deliveries"
          value={metrics?.pendingDeliveries || 0}
          icon={Clock}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ReportChart
          title="Orders by Status"
          data={statusChartData}
          type="pie"
        />
        <ReportChart
          title="Top 10 Items Ordered"
          data={topItemsChartData}
          type="bar"
          dataKey="value"
        />
      </div>

      <StoreInventoryReportTable
        data={tableData}
        exportFileName="store-inventory-report"
      />
    </div>
  );
}
