import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SelectComponentDialog } from "./SelectComponentDialog";
import { SelectRawMaterialForBomDialog } from "./SelectRawMaterialForBomDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BomParentType } from "./BomEditor";

export interface BomParentItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  stock_quantity: number;
  type: BomParentType;
}

interface ProductListProps {
  onSelectProduct: (item: BomParentItem) => void;
  selectedProductId?: string;
}

export function ProductList({ onSelectProduct, selectedProductId }: ProductListProps) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rmDialogOpen, setRmDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["bom-parents"],
    queryFn: async () => {
      const [productsRes, rawBomRes] = await Promise.all([
        supabase.from("products").select("id, name, sku, unit, stock_quantity").order("name"),
        supabase.from("bom_items").select("parent_raw_material_id").not("parent_raw_material_id", "is", null),
      ]);
      if (productsRes.error) throw productsRes.error;
      if (rawBomRes.error) throw rawBomRes.error;

      const products: BomParentItem[] = (productsRes.data || []).map((p: any) => ({
        ...p,
        type: "product" as BomParentType,
      }));

      const rmIds = [...new Set((rawBomRes.data || []).map((b: any) => b.parent_raw_material_id).filter(Boolean))];
      let rawMaterials: BomParentItem[] = [];
      if (rmIds.length > 0) {
        const { data: rms, error: rmErr } = await supabase
          .from("raw_materials")
          .select("id, name, sku, unit, stock_quantity")
          .in("id", rmIds);
        if (rmErr) throw rmErr;
        rawMaterials = (rms || []).map((r: any) => ({
          ...r,
          type: "raw_material" as BomParentType,
        }));
      }

      return [...products, ...rawMaterials].sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: BomParentItem) => {
      if (item.type === "product") {
        const { data: relatedOrders } = await supabase
          .from("assembly_orders")
          .select("id")
          .eq("product_id", item.id);
        if (relatedOrders && relatedOrders.length > 0) {
          const { error: delOrdersErr } = await supabase
            .from("assembly_orders")
            .delete()
            .eq("product_id", item.id);
          if (delOrdersErr) throw delOrdersErr;
        }
        const { error } = await supabase.from("products").delete().eq("id", item.id);
        if (error) throw error;
      } else {
        // Only delete BOM lines (don't delete the raw material itself)
        const { error } = await supabase
          .from("bom_items")
          .delete()
          .eq("parent_raw_material_id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bom-parents"] });
      queryClient.invalidateQueries({ queryKey: ["available-components-for-products"] });
      queryClient.invalidateQueries({ queryKey: ["assembly-orders"] });
      toast({ title: "BOM removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error removing BOM", description: error.message, variant: "destructive" });
    },
  });

  const filtered = items.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Products</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add from Inventory
            </Button>
            <Button onClick={() => setRmDialogOpen(true)} size="sm" variant="secondary">
              <Plus className="h-4 w-4 mr-2" />
              Add from Raw Materials
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">No products found</TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow
                    key={`${item.type}-${item.id}`}
                    className={`cursor-pointer ${selectedProductId === item.id ? "bg-accent" : ""}`}
                    onClick={() => onSelectProduct(item)}
                  >
                    <TableCell className="font-medium">{item.sku}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>
                      <Badge variant={item.type === "product" ? "default" : "outline"}>
                        {item.type === "product" ? "Product" : "Raw Material"}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">
                      <span className={item.stock_quantity <= 0 ? "text-destructive font-medium" : ""}>
                        {item.stock_quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          const msg = item.type === "product"
                            ? `Delete product "${item.name}"? This will also delete its BOM.`
                            : `Remove BOM recipe for raw material "${item.name}"? The raw material itself will not be deleted.`;
                          if (confirm(msg)) deleteMutation.mutate(item);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <SelectComponentDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <SelectRawMaterialForBomDialog
        open={rmDialogOpen}
        onOpenChange={setRmDialogOpen}
        onSelect={(rm) =>
          onSelectProduct({
            id: rm.id,
            name: rm.name,
            sku: rm.sku,
            unit: rm.unit,
            stock_quantity: rm.stock_quantity,
            type: "raw_material",
          })
        }
      />
    </Card>
  );
}
