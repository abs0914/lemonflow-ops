import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ReportCard } from "./ReportCard";
import { ReportTable } from "./ReportTable";
import { ReportChart } from "./ReportChart";
import { Package, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

interface StockMovementReportProps {
  dateRange: { from: Date; to: Date };
}

export function StockMovementReport({ dateRange }: StockMovementReportProps) {
  const [search, setSearch] = useState("");

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

  const { data: itemLookup } = useQuery({
    queryKey: ["report-stock-movements-items"],
    queryFn: async () => {
      const [rm, comp, fg, prod] = await Promise.all([
        supabase.from("raw_materials").select("id,name,sku,unit"),
        supabase.from("components").select("id,name,sku,unit"),
        supabase.from("finished_goods").select("id,name,sku,unit"),
        supabase.from("products").select("id,name,sku,unit"),
      ]);
      const map = new Map<string, { name: string; sku: string; unit: string }>();
      [rm.data, comp.data, fg.data, prod.data].forEach((rows) =>
        rows?.forEach((r: any) => map.set(r.id, { name: r.name, sku: r.sku, unit: r.unit }))
      );
      return map;
    },
  });

  const metrics = useMemo(() => {
    if (!movements) return null;
    const totalMovements = movements.length;
    const receipts = movements.filter((m) => m.quantity > 0);
    const adjustments = movements.filter((m) => m.quantity < 0);
    const totalReceived = receipts.reduce((sum, m) => sum + Number(m.quantity), 0);
    const totalAdjusted = Math.abs(adjustments.reduce((sum, m) => sum + Number(m.quantity), 0));
    const byType = movements.reduce((acc, m) => {
      const type = m.movement_type || "Unknown";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { totalMovements, totalReceived, totalAdjusted, receiptsCount: receipts.length, byType };
  }, [movements]);

  const typeChartData = useMemo(() => {
    if (!metrics?.byType) return [];
    return Object.entries(metrics.byType).map(([name, value]) => ({
      name: name.replace(/_/g, " "),
      value,
    }));
  }, [metrics]);

  // Per-item aggregation
  const perItem = useMemo(() => {
    if (!movements) return [];
    const groups = new Map<
      string,
      {
        item_id: string;
        item_type: string;
        name: string;
        sku: string;
        unit: string;
        stock_in: number;
        stock_out: number;
        net: number;
        movements: number;
        last_movement: string;
      }
    >();
    movements.forEach((m: any) => {
      const key = `${m.item_type}::${m.item_id}`;
      const info = itemLookup?.get(m.item_id);
      const qty = Number(m.quantity) || 0;
      const g =
        groups.get(key) || {
          item_id: m.item_id,
          item_type: m.item_type,
          name: info?.name || "(Unknown item)",
          sku: info?.sku || "-",
          unit: info?.unit || "",
          stock_in: 0,
          stock_out: 0,
          net: 0,
          movements: 0,
          last_movement: m.created_at,
        };
      if (qty >= 0) g.stock_in += qty;
      else g.stock_out += Math.abs(qty);
      g.net += qty;
      g.movements += 1;
      if (new Date(m.created_at) > new Date(g.last_movement)) g.last_movement = m.created_at;
      groups.set(key, g);
    });
    return Array.from(groups.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [movements, itemLookup]);

  const filteredPerItem = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return perItem;
    return perItem.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.item_type.toLowerCase().includes(q)
    );
  }, [perItem, search]);

  const perItemColumns = [
    { key: "sku", label: "SKU" },
    { key: "name", label: "Item" },
    { key: "item_type", label: "Type" },
    { key: "stock_in", label: "Stock In" },
    { key: "stock_out", label: "Stock Out" },
    { key: "net", label: "Net Change" },
    { key: "unit", label: "UOM" },
    { key: "movements", label: "# Moves" },
    { key: "last_movement", label: "Last Movement" },
  ];

  const perItemTableData = useMemo(
    () =>
      filteredPerItem.map((r) => ({
        sku: r.sku,
        name: r.name,
        item_type: r.item_type?.replace(/_/g, " "),
        stock_in: r.stock_in.toLocaleString(),
        stock_out: r.stock_out.toLocaleString(),
        net: `${r.net > 0 ? "+" : ""}${r.net.toLocaleString()}`,
        unit: r.unit,
        movements: r.movements,
        last_movement: new Date(r.last_movement).toLocaleDateString(),
      })),
    [filteredPerItem]
  );

  // Detail rows
  const detailColumns = [
    { key: "created_at", label: "Date" },
    { key: "sku", label: "SKU" },
    { key: "name", label: "Item" },
    { key: "movement_type", label: "Movement" },
    { key: "quantity", label: "Qty" },
    { key: "unit", label: "UOM" },
    { key: "batch_number", label: "Batch" },
    { key: "notes", label: "Notes" },
  ];

  const detailData = useMemo(() => {
    if (!movements) return [];
    const q = search.trim().toLowerCase();
    return movements
      .map((m: any) => {
        const info = itemLookup?.get(m.item_id);
        return {
          created_at: new Date(m.created_at).toLocaleString(),
          sku: info?.sku || "-",
          name: info?.name || "(Unknown)",
          movement_type: m.movement_type?.replace(/_/g, " ") || "Unknown",
          quantity: `${Number(m.quantity) > 0 ? "+" : ""}${Number(m.quantity).toLocaleString()}`,
          unit: info?.unit || m.unit_received || "",
          batch_number: m.batch_number || "-",
          notes: m.notes || "-",
        };
      })
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          r.movement_type.toLowerCase().includes(q)
      );
  }, [movements, itemLookup, search]);

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
        <ReportCard title="Total Movements" value={metrics?.totalMovements || 0} icon={Activity} />
        <ReportCard
          title="Total Stock In"
          value={metrics?.totalReceived?.toLocaleString() || 0}
          icon={ArrowUpRight}
        />
        <ReportCard
          title="Total Stock Out"
          value={metrics?.totalAdjusted?.toLocaleString() || 0}
          icon={ArrowDownRight}
        />
        <ReportCard
          title="Unique Items Moved"
          value={perItem.length}
          icon={Package}
        />
      </div>

      <ReportChart title="Movements by Type" data={typeChartData} type="pie" />

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by item name, SKU, or movement type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      <ReportTable
        title="Per-Item Movement Summary"
        columns={perItemColumns}
        data={perItemTableData}
        exportFileName="stock-movements-per-item"
      />

      <ReportTable
        title="Movement Details"
        columns={detailColumns}
        data={detailData}
        exportFileName="stock-movements-detailed"
      />
    </div>
  );
}
