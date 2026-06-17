import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface AdjustConsumptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produceMovementId: string | null;
  producedItemName?: string;
  producedQuantity?: number;
  itemType?: "component" | "raw_material";
  itemId?: string;
}

interface Row {
  item_id: string;
  item_type: "component" | "raw_material";
  name: string;
  sku: string;
  unit: string;
  expected: number;
  current_actual: number;
}

export function AdjustConsumptionDialog({
  open,
  onOpenChange,
  produceMovementId,
  producedItemName,
  producedQuantity,
  itemType,
  itemId,
}: AdjustConsumptionDialogProps) {
  const queryClient = useQueryClient();
  const [overrides, setOverrides] = React.useState<Record<string, string>>({});
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setOverrides({});
      setNotes("");
    }
  }, [open, produceMovementId]);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["production-consumption", produceMovementId],
    enabled: open && !!produceMovementId && !!itemType && !!itemId,
    queryFn: async (): Promise<Row[]> => {
      // Resolve BOM root (product or parent_raw_material)
      let productId: string | undefined;
      let parentRmId: string | undefined;
      if (itemType === "component") {
        const { data: prod } = await supabase
          .from("products")
          .select("id")
          .eq("component_id", itemId)
          .maybeSingle();
        productId = prod?.id;
      } else {
        parentRmId = itemId;
      }

      let bomQuery = supabase
        .from("bom_items")
        .select("item_type, raw_material_id, component_id, quantity");
      if (productId) bomQuery = bomQuery.eq("product_id", productId);
      else if (parentRmId) bomQuery = bomQuery.eq("parent_raw_material_id", parentRmId);
      else return [];

      const { data: bom, error: bomErr } = await bomQuery;
      if (bomErr) throw bomErr;
      if (!bom || bom.length === 0) return [];

      const rawIds = bom.filter((b: any) => b.item_type === "raw_material").map((b: any) => b.raw_material_id).filter(Boolean);
      const compIds = bom.filter((b: any) => b.item_type === "component").map((b: any) => b.component_id).filter(Boolean);

      const [rmRes, cRes, movRes] = await Promise.all([
        rawIds.length > 0
          ? supabase.from("raw_materials").select("id, name, sku, unit").in("id", rawIds)
          : Promise.resolve({ data: [] as any[] }),
        compIds.length > 0
          ? supabase.from("components").select("id, name, sku, unit").in("id", compIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("stock_movements")
          .select("item_id, item_type, quantity, movement_type")
          .eq("reference_type", "stock_movement")
          .eq("reference_id", produceMovementId)
          .in("movement_type", ["assembly_consume", "assembly_adjust"]),
      ]);
      const rmMap = new Map<string, any>((rmRes.data || []).map((r: any) => [r.id, r]));
      const cMap = new Map<string, any>((cRes.data || []).map((c: any) => [c.id, c]));

      // Aggregate current consumed per item (sum of -quantity since consumes are negative)
      const consumedMap = new Map<string, number>();
      for (const m of (movRes.data || []) as any[]) {
        const key = `${m.item_type}:${m.item_id}`;
        consumedMap.set(key, (consumedMap.get(key) || 0) + -Number(m.quantity));
      }

      const qty = Number(producedQuantity) || 0;
      return bom.map((b: any) => {
        const isRaw = b.item_type === "raw_material";
        const id = isRaw ? b.raw_material_id : b.component_id;
        const info = isRaw ? rmMap.get(id) : cMap.get(id);
        const key = `${b.item_type}:${id}`;
        return {
          item_id: id,
          item_type: b.item_type as "raw_material" | "component",
          name: info?.name || "(Unknown)",
          sku: info?.sku || "-",
          unit: info?.unit || "",
          expected: Number(b.quantity) * qty,
          current_actual: consumedMap.get(key) || 0,
        };
      });
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!produceMovementId || !rows) throw new Error("Nothing to adjust");
      const adjustments = rows
        .map((r) => {
          const key = `${r.item_type}:${r.item_id}`;
          const raw = overrides[key];
          if (raw === undefined || raw === "") return null;
          const num = Number(raw);
          if (!Number.isFinite(num) || num < 0) return null;
          if (num === r.current_actual) return null;
          return { item_id: r.item_id, item_type: r.item_type, quantity: num };
        })
        .filter(Boolean);

      if (adjustments.length === 0) {
        throw new Error("No changes to save");
      }

      const { data, error } = await supabase.rpc("adjust_production_consumption", {
        p_produce_movement_id: produceMovementId,
        p_adjustments: adjustments,
        p_notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-logs"] });
      queryClient.invalidateQueries({ queryKey: ["production-consumption"] });
      queryClient.invalidateQueries({ queryKey: ["components"] });
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["production-report"] });
      toast({ title: "Consumption adjusted", description: "Inventory updated with new actual usage." });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to adjust consumption",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[820px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adjust Materials Used</DialogTitle>
          <DialogDescription>
            {producedItemName ? `${producedItemName} — produced qty ${producedQuantity}` : "Update actual material quantities consumed."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-40" />
        ) : !rows || rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No BOM ingredients found for this production log.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Current Actual</TableHead>
                    <TableHead className="w-[140px]">New Actual</TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const key = `${r.item_type}:${r.item_id}`;
                    const raw = overrides[key];
                    const newVal = raw !== undefined && raw !== "" ? Number(raw) : r.current_actual;
                    const delta = Number.isFinite(newVal) ? newVal - r.current_actual : 0;
                    return (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.sku}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.expected.toLocaleString(undefined, { maximumFractionDigits: 3 })} {r.unit}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.current_actual.toLocaleString(undefined, { maximumFractionDigits: 3 })} {r.unit}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.001"
                            value={raw ?? r.current_actual.toString()}
                            onChange={(e) =>
                              setOverrides((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums text-xs",
                            delta > 0 && "text-destructive",
                            delta < 0 && "text-emerald-600"
                          )}
                        >
                          {delta === 0
                            ? "—"
                            : `${delta > 0 ? "+" : ""}${delta.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${r.unit}`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjust-notes">Adjustment Note (Optional)</Label>
              <Textarea
                id="adjust-notes"
                placeholder="Why is this being adjusted?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={adjustMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={() => adjustMutation.mutate()} disabled={adjustMutation.isPending}>
                {adjustMutation.isPending ? "Saving..." : "Save Adjustments"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
