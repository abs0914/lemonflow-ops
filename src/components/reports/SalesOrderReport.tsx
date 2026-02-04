import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ReportCard } from "./ReportCard";
import { SalesOrderReportTable } from "./SalesOrderReportTable";
import { ReportChart } from "./ReportChart";
import { ShoppingBag, DollarSign, Clock, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";

interface SalesOrderReportProps {
  dateRange: { from: Date; to: Date };
}

export function SalesOrderReport({ dateRange }: SalesOrderReportProps) {
  const { profile, user } = useAuth();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["report-sales-orders", dateRange.from, dateRange.to, user?.id],
    queryFn: async () => {
      let query = supabase
        .from("sales_orders")
        .select(`
          *,
          stores(store_name, store_code),
          sales_order_lines(quantity, unit_price, sub_total)
        `)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at", { ascending: false });

      // Store users only see their store's orders
      if (profile?.role === "Store" && user?.id) {
        const { data: assignments } = await supabase
          .from("user_store_assignments")
          .select("store_id")
          .eq("user_id", user.id);

        const storeIds = assignments?.map((a) => a.store_id) || [];
        if (storeIds.length > 0) {
          query = query.in("store_id", storeIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch components for cost calculation
  const { data: components } = useQuery({
    queryKey: ["components-cost"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("components")
        .select("sku, cost_per_unit");
      if (error) throw error;
      return data;
    },
  });

  const componentCostMap = useMemo(() => {
    if (!components) return new Map<string, number>();
    return new Map(components.map((c) => [c.sku, c.cost_per_unit || 0]));
  }, [components]);

  const metrics = useMemo(() => {
    if (!orders) return null;

    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const draft = orders.filter((o) => o.status === "draft").length;
    
    // Calculate total cost and profit
    let totalCost = 0;
    orders.forEach((o) => {
      (o.sales_order_lines || []).forEach((line: any) => {
        const unitCost = componentCostMap.get(line.item_code) || 0;
        totalCost += unitCost * line.quantity;
      });
    });
    const totalProfit = totalSales - totalCost;

    const byStatus = orders.reduce((acc, o) => {
      acc[o.status || "unknown"] = (acc[o.status || "unknown"] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byStore = orders.reduce((acc, o) => {
      const name = o.stores?.store_name || "Unknown";
      acc[name] = (acc[name] || 0) + (o.total_amount || 0);
      return acc;
    }, {} as Record<string, number>);

    return {
      totalOrders,
      totalSales,
      totalCost,
      totalProfit,
      draft,
      byStatus,
      byStore,
    };
  }, [orders, componentCostMap]);

  const statusChartData = useMemo(() => {
    if (!metrics?.byStatus) return [];
    return Object.entries(metrics.byStatus).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [metrics]);

  const storeChartData = useMemo(() => {
    if (!metrics?.byStore) return [];
    return Object.entries(metrics.byStore)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({
        name: name.length > 15 ? name.substring(0, 15) + "..." : name,
        value: Number(value.toFixed(2)),
      }));
  }, [metrics]);

  const tableData = useMemo(() => {
    if (!orders) return [];
    return orders.map((o) => {
      // Calculate cost for this order
      let orderCost = 0;
      (o.sales_order_lines || []).forEach((line: any) => {
        const unitCost = componentCostMap.get(line.item_code) || 0;
        orderCost += unitCost * line.quantity;
      });
      const orderAmount = o.total_amount || 0;
      const orderProfit = orderAmount - orderCost;

      return {
        order_number: o.order_number,
        store: o.stores?.store_name || "Unknown",
        status: o.status || "unknown",
        total_cost: orderCost,
        total_amount: orderAmount,
        profit: orderProfit,
        doc_date: new Date(o.doc_date).toLocaleDateString(),
      };
    });
  }, [orders, componentCostMap]);

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
          title="Total Orders"
          value={metrics?.totalOrders || 0}
          icon={ShoppingBag}
        />
        <ReportCard
          title="Total Sales"
          value={`₱${(metrics?.totalSales || 0).toLocaleString()}`}
          icon={DollarSign}
        />
        <ReportCard
          title="Total Cost"
          value={`₱${(metrics?.totalCost || 0).toLocaleString()}`}
          icon={Clock}
        />
        <ReportCard
          title="Total Profit"
          value={`₱${(metrics?.totalProfit || 0).toLocaleString()}`}
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ReportChart
          title="Orders by Status"
          data={statusChartData}
          type="pie"
        />
        <ReportChart
          title="Top 5 Stores by Sales"
          data={storeChartData}
          type="bar"
          dataKey="value"
        />
      </div>

      <SalesOrderReportTable
        data={tableData}
        exportFileName="sales-orders-report"
      />
    </div>
  );
}
