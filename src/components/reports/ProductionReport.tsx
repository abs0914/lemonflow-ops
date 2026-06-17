import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ReportCard } from "./ReportCard";
import { ReportTable } from "./ReportTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Factory, Package, AlertTriangle, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface ProductionReportProps {
  dateRange: { from: Date; to: Date };
}

interface ProduceMovement {
  id: string;
  item_id: string;
  item_type: string;
  quantity: number;
  created_at: string;
  notes: string | null;
}

interface ConsumeMovement {
  reference_id: string;
  item_id: string;
  item_type: string;
  quantity: number;
  movement_type: string;
}

export function ProductionReport({ dateRange }: ProductionReportProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["production-report", dateRange.from, dateRange.to],
    queryFn: async () => {
      // 1. Produce movements in date range
      const { data: produces, error: prodErr } = await supabase
        .from("stock_movements")
        .select("id, item_id, item_type, quantity, created_at, notes")
        .eq("movement_type", "assembly_produce")
        .in("item_type", ["component", "raw_material"])
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at", { ascending: false });
      if (prodErr) throw prodErr;
      const produceList = (produces || []) as ProduceMovement[];

      if (produceList.length === 0) {
        return { rows: [], totals: { produces: 0, items: 0, varianceLines: 0 } };
      }

      // 2. Linked consume + adjust movements
      const produceIds = produceList.map((p) => p.id);
      const { data: consumes } = await supabase
        .from("stock_movements")
        .select("reference_id, item_id, item_type, quantity, movement_type")
        .eq("reference_type", "stock_movement")
        .in("reference_id", produceIds)
        .in("movement_type", ["assembly_consume", "assembly_adjust"]);
      const consumeList = (consumes || []) as ConsumeMovement[];

      // 3. Lookup produced item names + BOMs
      const compIds = [...new Set(produceList.filter((p) => p.item_type === "component").map((p) => p.item_id))];
      const rawIds = [...new Set(produceList.filter((p) => p.item_type === "raw_material").map((p) => p.item_id))];

      const [compsRes, rawsRes, productsRes] = await Promise.all([
        compIds.length > 0
          ? supabase.from("components").select("id, name, sku, unit").in("id", compIds)
          : Promise.resolve({ data: [] as any[] }),
        rawIds.length > 0
          ? supabase.from("raw_materials").select("id, name, sku, unit").in("id", rawIds)
          : Promise.resolve({ data: [] as any[] }),
        compIds.length > 0
          ? supabase.from("products").select("id, component_id").in("component_id", compIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const compMap = new Map<string, any>((compsRes.data || []).map((c: any) => [c.id, c]));
      const rawMap = new Map<string, any>((rawsRes.data || []).map((r: any) => [r.id, r]));
      const compToProduct = new Map<string, string>(
        (productsRes.data || []).map((p: any) => [p.component_id, p.id])
      );

      // 4. BOMs for each produced item (productId or parent_raw_material_id)
      const productIds = [...new Set(Array.from(compToProduct.values()))];
      const parentRmIds = rawIds;

      const bomQueries: Promise<any>[] = [];
      if (productIds.length > 0) {
        bomQueries.push(
          supabase
            .from("bom_items")
            .select("product_id, parent_raw_material_id, item_type, raw_material_id, component_id, quantity")
            .in("product_id", productIds)
        );
      }
      if (parentRmIds.length > 0) {
        bomQueries.push(
          supabase
            .from("bom_items")
            .select("product_id, parent_raw_material_id, item_type, raw_material_id, component_id, quantity")
            .in("parent_raw_material_id", parentRmIds)
        );
      }
      const bomResults = await Promise.all(bomQueries);
      const bomItems = bomResults.flatMap((r) => r.data || []);

      // Index BOM by produced "root" id
      const bomByRoot = new Map<string, any[]>();
      for (const bi of bomItems) {
        const key = bi.product_id || bi.parent_raw_material_id;
        if (!key) continue;
        const arr = bomByRoot.get(key) || [];
        arr.push(bi);
        bomByRoot.set(key, arr);
      }

      // Lookup ingredient names
      const ingredientRawIds = [...new Set(bomItems.filter((b: any) => b.item_type === "raw_material").map((b: any) => b.raw_material_id).filter(Boolean))];
      const ingredientCompIds = [...new Set(bomItems.filter((b: any) => b.item_type === "component").map((b: any) => b.component_id).filter(Boolean))];

      const [ingRawRes, ingCompRes] = await Promise.all([
        ingredientRawIds.length > 0
          ? supabase.from("raw_materials").select("id, name, sku, unit").in("id", ingredientRawIds)
          : Promise.resolve({ data: [] as any[] }),
        ingredientCompIds.length > 0
          ? supabase.from("components").select("id, name, sku, unit").in("id", ingredientCompIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const ingRawMap = new Map<string, any>((ingRawRes.data || []).map((r: any) => [r.id, r]));
      const ingCompMap = new Map<string, any>((ingCompRes.data || []).map((c: any) => [c.id, c]));

      // 5. Build per-(date,item,material) aggregation
      // Key: date|producedItemId|materialKey
      type RowKey = string;
      const acc = new Map<
        RowKey,
        {
          date: string;
          produced_item_id: string;
          produced_name: string;
          produced_sku: string;
          produced_unit: string;
          produced_qty: number;
          material_name: string;
          material_sku: string;
          material_unit: string;
          expected: number;
          actual: number;
        }
      >();

      // Per-produce: aggregate consumed totals
      const consumedByProduce = new Map<string, Map<string, number>>();
      for (const c of consumeList) {
        const mp = consumedByProduce.get(c.reference_id) || new Map<string, number>();
        const k = `${c.item_type}:${c.item_id}`;
        mp.set(k, (mp.get(k) || 0) + -Number(c.quantity));
        consumedByProduce.set(c.reference_id, mp);
      }

      for (const p of produceList) {
        const dateKey = format(new Date(p.created_at), "yyyy-MM-dd");
        const produced = p.item_type === "component" ? compMap.get(p.item_id) : rawMap.get(p.item_id);
        const producedName = produced?.name || "(Unknown)";
        const producedSku = produced?.sku || "-";
        const producedUnit = produced?.unit || "";

        const rootKey =
          p.item_type === "component" ? compToProduct.get(p.item_id) : p.item_id;
        const boms = rootKey ? bomByRoot.get(rootKey) || [] : [];

        const consumed = consumedByProduce.get(p.id) || new Map<string, number>();

        if (boms.length === 0) {
          // produced without BOM — still register the produce row
          const key = `${dateKey}|${p.item_type}:${p.item_id}|__none__`;
          const existing = acc.get(key);
          if (existing) {
            existing.produced_qty += Number(p.quantity);
          } else {
            acc.set(key, {
              date: dateKey,
              produced_item_id: p.item_id,
              produced_name: producedName,
              produced_sku: producedSku,
              produced_unit: producedUnit,
              produced_qty: Number(p.quantity),
              material_name: "(No BOM)",
              material_sku: "-",
              material_unit: "",
              expected: 0,
              actual: 0,
            });
          }
          continue;
        }

        for (const bi of boms) {
          const isRaw = bi.item_type === "raw_material";
          const matId = isRaw ? bi.raw_material_id : bi.component_id;
          const matInfo = isRaw ? ingRawMap.get(matId) : ingCompMap.get(matId);
          const matKey = `${bi.item_type}:${matId}`;
          const expected = Number(bi.quantity) * Number(p.quantity);
          const actual = consumed.get(matKey) || 0;

          const key = `${dateKey}|${p.item_type}:${p.item_id}|${matKey}`;
          const existing = acc.get(key);
          if (existing) {
            // Aggregate across multiple produces of the same item on the same day:
            // produced_qty has already been added once per produce — re-add only on the first
            // material row for that produce. Use a separate marker by tracking produce ids.
            existing.expected += expected;
            existing.actual += actual;
          } else {
            acc.set(key, {
              date: dateKey,
              produced_item_id: p.item_id,
              produced_name: producedName,
              produced_sku: producedSku,
              produced_unit: producedUnit,
              produced_qty: Number(p.quantity),
              material_name: matInfo?.name || "(Unknown)",
              material_sku: matInfo?.sku || "-",
              material_unit: matInfo?.unit || "",
              expected,
              actual,
            });
          }
        }
      }

      // produced_qty needs to be aggregated per (date,item) once, not per material row.
      // Recompute produced_qty totals from produces.
      const producedQtyByGroup = new Map<string, number>();
      for (const p of produceList) {
        const dateKey = format(new Date(p.created_at), "yyyy-MM-dd");
        const gKey = `${dateKey}|${p.item_type}:${p.item_id}`;
        producedQtyByGroup.set(gKey, (producedQtyByGroup.get(gKey) || 0) + Number(p.quantity));
      }
      const rows = Array.from(acc.values()).map((r) => {
        const gKey = `${r.date}|${r.produced_item_id.includes(":") ? r.produced_item_id : `component:${r.produced_item_id}`}`;
        // produced_qty is best taken from the aggregated map for that (date, produced item type+id)
        // We don't have item_type stored on r — reconstruct from rows above is messy; instead
        // recompute using both possible keys:
        const compKey = `${r.date}|component:${r.produced_item_id}`;
        const rawKey = `${r.date}|raw_material:${r.produced_item_id}`;
        r.produced_qty =
          producedQtyByGroup.get(compKey) ?? producedQtyByGroup.get(rawKey) ?? r.produced_qty;
        return r;
      });

      // Sort by date desc, item, material
      rows.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        if (a.produced_name !== b.produced_name) return a.produced_name.localeCompare(b.produced_name);
        return a.material_name.localeCompare(b.material_name);
      });

      const uniqueProduces = produceList.length;
      const uniqueItems = new Set(produceList.map((p) => `${p.item_type}:${p.item_id}`)).size;
      const varianceLines = rows.filter((r) => Math.abs(r.actual - r.expected) > 0.0001).length;

      return {
        rows,
        totals: { produces: uniqueProduces, items: uniqueItems, varianceLines },
      };
    },
  });

  const tableColumns = [
    { key: "date", label: "Date" },
    { key: "produced_name", label: "Item" },
    { key: "produced_sku", label: "SKU" },
    { key: "produced_qty", label: "Qty Produced" },
    { key: "material_name", label: "Material" },
    { key: "expected", label: "Expected" },
    { key: "actual", label: "Actual Used" },
    { key: "variance", label: "Variance" },
    { key: "variance_pct", label: "Variance %" },
  ];

  const tableData = useMemo(() => {
    if (!data) return [];
    return data.rows.map((r) => {
      const variance = r.actual - r.expected;
      const pct = r.expected > 0 ? (variance / r.expected) * 100 : 0;
      const fmt = (n: number) =>
        n.toLocaleString(undefined, { maximumFractionDigits: 3 });
      return {
        date: r.date,
        produced_name: r.produced_name,
        produced_sku: r.produced_sku,
        produced_qty: `${fmt(r.produced_qty)} ${r.produced_unit}`,
        material_name: r.material_name,
        expected: `${fmt(r.expected)} ${r.material_unit}`,
        actual: `${fmt(r.actual)} ${r.material_unit}`,
        variance:
          r.material_sku === "-" && r.expected === 0
            ? "—"
            : `${variance > 0 ? "+" : ""}${fmt(variance)} ${r.material_unit}`,
        variance_pct:
          r.expected > 0 ? `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%` : "—",
      };
    });
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <ReportCard title="Production Runs" value={data?.totals.produces || 0} icon={Factory} />
        <ReportCard title="Unique Items" value={data?.totals.items || 0} icon={Package} />
        <ReportCard
          title="Lines with Variance"
          value={data?.totals.varianceLines || 0}
          icon={AlertTriangle}
        />
      </div>

      <ReportTable
        title="Daily Production — Materials Used"
        columns={tableColumns}
        data={tableData}
        exportFileName="production-report"
      />
    </div>
  );
}
