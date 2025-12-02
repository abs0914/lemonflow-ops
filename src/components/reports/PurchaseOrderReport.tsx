import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ReportCard } from "./ReportCard";
import { ReportTable } from "./ReportTable";
import { ReportChart } from "./ReportChart";
import { ShoppingCart, DollarSign, Clock, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PurchaseOrderReportProps {
  dateRange: { from: Date; to: Date };
}

export function PurchaseOrderReport({ dateRange }: PurchaseOrderReportProps) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["report-purchase-orders", dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          suppliers(company_name)
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
    const totalSpending = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const pendingApproval = orders.filter((o) => o.status === "submitted").length;
    const completed = orders.filter((o) => o.status === "received").length;

    const byStatus = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bySupplier = orders.reduce((acc, o) => {
      const name = o.suppliers?.company_name || "Unknown";
      acc[name] = (acc[name] || 0) + (o.total_amount || 0);
      return acc;
    }, {} as Record<string, number>);

    return {
      totalOrders,
      totalSpending,
      pendingApproval,
      completed,
      byStatus,
      bySupplier,
    };
  }, [orders]);

  const statusChartData = useMemo(() => {
    if (!metrics?.byStatus) return [];
    return Object.entries(metrics.byStatus).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [metrics]);

  const supplierChartData = useMemo(() => {
    if (!metrics?.bySupplier) return [];
    return Object.entries(metrics.bySupplier)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({
        name: name.length > 15 ? name.substring(0, 15) + "..." : name,
        value: Number(value.toFixed(2)),
      }));
  }, [metrics]);

  const tableColumns = [
    { key: "po_number", label: "PO Number" },
    { key: "supplier", label: "Supplier" },
    { key: "status", label: "Status" },
    { key: "total_amount", label: "Amount", format: (v: number) => `₱${v.toLocaleString()}` },
    { key: "doc_date", label: "Date" },
  ];

  const tableData = useMemo(() => {
    if (!orders) return [];
    return orders.map((o) => ({
      po_number: o.po_number,
      supplier: o.suppliers?.company_name || "Unknown",
      status: o.status,
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
          icon={ShoppingCart}
        />
        <ReportCard
          title="Total Spending"
          value={`₱${(metrics?.totalSpending || 0).toLocaleString()}`}
          icon={DollarSign}
        />
        <ReportCard
          title="Pending Approval"
          value={metrics?.pendingApproval || 0}
          icon={Clock}
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
          title="Top 5 Suppliers by Spending"
          data={supplierChartData}
          type="bar"
          dataKey="value"
        />
      </div>

      <ReportTable
        title="Purchase Orders"
        columns={tableColumns}
        data={tableData}
        exportFileName="purchase-orders-report"
      />
    </div>
  );
}
