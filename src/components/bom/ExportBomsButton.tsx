import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ParentRow {
  id: string;
  sku: string;
  name: string;
  unit: string;
  type: "product" | "raw_material";
}

const HEADERS = [
  "Parent SKU",
  "Parent Name",
  "Parent Type",
  "Parent Unit",
  "Item SKU",
  "Item Name",
  "Item Type",
  "Quantity",
  "Unit",
  "Cost per Unit",
  "Line Total",
  "Notes",
];

function csvCell(value: unknown) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function ExportBomsButton() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setLoading(true);
    try {
      const [productsRes, bomRes, rawFlagRes] = await Promise.all([
        supabase.from("products").select("id, name, sku, unit").order("name"),
        supabase
          .from("bom_items")
          .select(
            "*, raw_materials!bom_items_raw_material_id_fkey(name, sku, unit, cost_per_unit), components(name, sku, unit, cost_per_unit)"
          ),
        supabase.from("raw_materials").select("id").eq("is_bom_product", true),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (bomRes.error) throw bomRes.error;
      if (rawFlagRes.error) throw rawFlagRes.error;

      const bomItems = (bomRes.data || []) as any[];

      const rmIds = Array.from(
        new Set<string>([
          ...(bomItems.map((b) => b.parent_raw_material_id).filter(Boolean) as string[]),
          ...((rawFlagRes.data || []).map((r: any) => r.id) as string[]),
        ])
      );

      let rawParents: ParentRow[] = [];
      if (rmIds.length > 0) {
        const { data: rms, error: rmErr } = await supabase
          .from("raw_materials")
          .select("id, name, sku, unit")
          .in("id", rmIds);
        if (rmErr) throw rmErr;
        rawParents = (rms || []).map((r: any) => ({ ...r, type: "raw_material" as const }));
      }

      const parents: ParentRow[] = [
        ...(productsRes.data || []).map((p: any) => ({ ...p, type: "product" as const })),
        ...rawParents,
      ].sort((a, b) => a.name.localeCompare(b.name));

      if (parents.length === 0) {
        toast({ title: "Nothing to export", description: "No BOMs found." });
        return;
      }

      const rows: string[] = [];
      for (const parent of parents) {
        const lines = bomItems.filter((b) =>
          parent.type === "product"
            ? b.product_id === parent.id
            : b.parent_raw_material_id === parent.id
        );

        const parentCells = [
          parent.sku,
          parent.name,
          parent.type === "product" ? "Product" : "Raw Material",
          parent.unit,
        ];

        if (lines.length === 0) {
          rows.push([...parentCells, "", "", "", "", "", "", "", ""].map(csvCell).join(","));
          continue;
        }

        for (const line of lines) {
          const details =
            line.item_type === "component" && line.components
              ? line.components
              : line.raw_materials || { name: "Unknown", sku: "-", unit: "-", cost_per_unit: null };
          const cost = details.cost_per_unit ?? null;
          rows.push(
            [
              ...parentCells,
              details.sku,
              details.name,
              line.item_type === "component" ? "Inventory Item" : "Raw Material",
              line.quantity,
              details.unit,
              cost ?? "",
              cost !== null ? Number(cost) * Number(line.quantity) : "",
              line.notes ?? "",
            ]
              .map(csvCell)
              .join(",")
          );
        }
      }

      const csv = [HEADERS.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bom-export-${new Date().toISOString().split("T")[0]}.csv`;
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "BOM export ready", description: `${parents.length} BOMs exported.` });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error?.message || "Could not export BOMs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      Export All BOMs
    </Button>
  );
}
