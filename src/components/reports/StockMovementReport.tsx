import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ReportCard } from "./ReportCard";
import { ReportTable } from "./ReportTable";
import { ReportChart } from "./ReportChart";
import { Package, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface StockMovementReportProps {
  dateRange: { from: Date; to: Date };
}

export function StockMovementReport({ dateRange }: StockMovementReportProps) {
  const { data: movements, isLoading } = useQuery({
    queryKey: ["report-stock-movements", dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*")
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const metrics = useMemo(() => {
    if (!movements) return null;

    const totalMovements = movements.length;
    const receipts = movements.filter((m) => m.quantity > 0);
    const adjustments = movements.filter((m) => m.quantity < 0);
    const totalReceived = receipts.reduce((sum, m) => sum + m.quantity, 0);
    const totalAdjusted = Math.abs(adjustments.reduce((sum, m) => sum + m.quantity, 0));

    const byType = movements.reduce((acc, m) => {
      const type = m.movement_type || "Unknown";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byItemType = movements.reduce((acc, m) => {
      const type = m.item_type || "Unknown";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalMovements,
      totalReceived,
      totalAdjusted,
      receiptsCount: receipts.length,
      byType,
      byItemType,
    };
  }, [movements]);

  const typeChartData = useMemo(() => {
    if (!metrics?.byType) return [];
    return Object.entries(metrics.byType).map(([name, value]) => ({
      name: name.replace(/_/g, " "),
      value,
    }));
  }, [metrics]);

  const itemTypeChartData = useMemo(() => {
    if (!metrics?.byItemType) return [];
    return Object.entries(metrics.byItemType).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [metrics]);

  const tableColumns = [
    { key: "movement_type", label: "Type" },
    { key: "item_type", label: "Item Type" },
    { key: "quantity", label: "Quantity" },
    { key: "batch_number", label: "Batch" },
    { key: "created_at", label: "Date" },
  ];

  const tableData = useMemo(() => {
    if (!movements) return [];
    return movements.slice(0, 50).map((m) => ({
      movement_type: m.movement_type?.replace(/_/g, " ") || "Unknown",
      item_type: m.item_type || "Unknown",
      quantity: m.quantity,
      batch_number: m.batch_number || "-",
      created_at: new Date(m.created_at).toLocaleDateString(),
    }));
  }, [movements]);

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
          title="Total Movements"
          value={metrics?.totalMovements || 0}
          icon={Activity}
        />
        <ReportCard
          title="Total Received"
          value={metrics?.totalReceived?.toLocaleString() || 0}
          icon={ArrowUpRight}
        />
        <ReportCard
          title="Total Adjusted"
          value={metrics?.totalAdjusted?.toLocaleString() || 0}
          icon={ArrowDownRight}
        />
        <ReportCard
          title="Receipt Entries"
          value={metrics?.receiptsCount || 0}
          icon={Package}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ReportChart
          title="Movements by Type"
          data={typeChartData}
          type="pie"
        />
        <ReportChart
          title="Movements by Item Type"
          data={itemTypeChartData}
          type="bar"
          dataKey="value"
        />
      </div>

      <ReportTable
        title="Recent Stock Movements (Last 50)"
        columns={tableColumns}
        data={tableData}
        exportFileName="stock-movements-report"
      />
    </div>
  );
}
