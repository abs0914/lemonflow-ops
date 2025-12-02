import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ReportCard } from "./ReportCard";
import { ReportTable } from "./ReportTable";
import { ReportChart } from "./ReportChart";
import { ShoppingBag, DollarSign, Clock, CheckCircle } from "lucide-react";
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
          stores(store_name, store_code)
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

  const metrics = useMemo(() => {
    if (!orders) return null;

    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const draft = orders.filter((o) => o.status === "draft").length;
    const submitted = orders.filter((o) => o.status === "submitted").length;
    const synced = orders.filter((o) => o.autocount_synced).length;

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
      draft,
      submitted,
      synced,
      byStatus,
      byStore,
    };
  }, [orders]);

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

  const tableColumns = [
    { key: "order_number", label: "Order Number" },
    { key: "store", label: "Store" },
    { key: "status", label: "Status" },
    { key: "total_amount", label: "Amount", format: (v: number) => `₱${v.toLocaleString()}` },
    { key: "doc_date", label: "Date" },
  ];

  const tableData = useMemo(() => {
    if (!orders) return [];
    return orders.map((o) => ({
      order_number: o.order_number,
      store: o.stores?.store_name || "Unknown",
      status: o.status || "unknown",
      total_amount: o.total_amount || 0,
      doc_date: new Date(o.doc_date).toLocaleDateString(),
    }));
  }, [orders]);

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
          title="Draft Orders"
          value={metrics?.draft || 0}
          icon={Clock}
        />
        <ReportCard
          title="Submitted"
          value={metrics?.submitted || 0}
          icon={CheckCircle}
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

      <ReportTable
        title="Sales Orders"
        columns={tableColumns}
        data={tableData}
        exportFileName="sales-orders-report"
      />
    </div>
  );
}
