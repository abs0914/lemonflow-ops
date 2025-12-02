import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ReportCard } from "./ReportCard";
import { ReportTable } from "./ReportTable";
import { ReportChart } from "./ReportChart";
import { Factory, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AssemblyOrderReportProps {
  dateRange: { from: Date; to: Date };
}

export function AssemblyOrderReport({ dateRange }: AssemblyOrderReportProps) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["report-assembly-orders", dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assembly_orders")
        .select(`
          *,
          products(name, sku)
        `)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const metrics = useMemo(() => {
    if (!orders) return null;

    const totalOrders = orders.length;
    const pending = orders.filter((o) => o.status === "pending").length;
    const inProgress = orders.filter((o) => o.status === "in_progress").length;
    const completed = orders.filter((o) => o.status === "completed").length;
    const totalQuantity = orders.reduce((sum, o) => sum + (o.quantity || 0), 0);

    const byStatus = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byProduct = orders.reduce((acc, o) => {
      const name = o.products?.name || "Unknown";
      acc[name] = (acc[name] || 0) + (o.quantity || 0);
      return acc;
    }, {} as Record<string, number>);

    return {
      totalOrders,
      pending,
      inProgress,
      completed,
      totalQuantity,
      byStatus,
      byProduct,
    };
  }, [orders]);

  const statusChartData = useMemo(() => {
    if (!metrics?.byStatus) return [];
    return Object.entries(metrics.byStatus).map(([name, value]) => ({
      name: name.replace(/_/g, " ").charAt(0).toUpperCase() + name.replace(/_/g, " ").slice(1),
      value,
    }));
  }, [metrics]);

  const productChartData = useMemo(() => {
    if (!metrics?.byProduct) return [];
    return Object.entries(metrics.byProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({
        name: name.length > 15 ? name.substring(0, 15) + "..." : name,
        value,
      }));
  }, [metrics]);

  const tableColumns = [
    { key: "product", label: "Product" },
    { key: "quantity", label: "Quantity" },
    { key: "status", label: "Status" },
    { key: "due_date", label: "Due Date" },
    { key: "created_at", label: "Created" },
  ];

  const tableData = useMemo(() => {
    if (!orders) return [];
    return orders.map((o) => ({
      product: o.products?.name || "Unknown",
      quantity: o.quantity,
      status: o.status.replace(/_/g, " "),
      due_date: o.due_date ? new Date(o.due_date).toLocaleDateString() : "-",
      created_at: new Date(o.created_at).toLocaleDateString(),
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
          icon={Factory}
        />
        <ReportCard
          title="Pending"
          value={metrics?.pending || 0}
          icon={Clock}
        />
        <ReportCard
          title="In Progress"
          value={metrics?.inProgress || 0}
          icon={AlertCircle}
        />
        <ReportCard
          title="Completed"
          value={metrics?.completed || 0}
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
          title="Top 5 Products by Quantity"
          data={productChartData}
          type="bar"
          dataKey="value"
        />
      </div>

      <ReportTable
        title="Assembly Orders"
        columns={tableColumns}
        data={tableData}
        exportFileName="assembly-orders-report"
      />
    </div>
  );
}
