import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RawMaterial {
  id: string;
  sku: string;
  name: string;
  unit: string;
  stock_quantity: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (rm: RawMaterial) => void;
}

export function SelectRawMaterialForBomDialog({ open, onOpenChange, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RawMaterial | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rawMaterials = [], isLoading } = useQuery({
    queryKey: ["raw-materials-for-bom-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raw_materials")
        .select("id, sku, name, unit, stock_quantity")
        .order("name");
      if (error) throw error;
      return data as RawMaterial[];
    },
    enabled: open,
  });

  const filtered = rawMaterials.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("raw_materials")
      .update({ is_bom_product: true })
      .eq("id", selected.id)
      .select("id");
    setSaving(false);
    if (error || !data || data.length === 0) {
      toast({
        title: "Could not add raw material",
        description: error?.message || "Permission denied or raw material not found.",
        variant: "destructive",
      });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["bom-parents"] });
    queryClient.invalidateQueries({ queryKey: ["bom-production-options"] });
    onSelect(selected);
    onOpenChange(false);
    setSelected(null);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Raw Material for BOM</DialogTitle>
          <DialogDescription>
            Choose a raw material to define a recipe for producing it (e.g. puree from fruit).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="border rounded-md max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">No raw materials found</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((rm) => (
                    <TableRow
                      key={rm.id}
                      className={`cursor-pointer ${selected?.id === rm.id ? "bg-accent" : ""}`}
                      onClick={() => setSelected(rm)}
                    >
                      <TableCell className="font-medium">{rm.sku}</TableCell>
                      <TableCell>{rm.name}</TableCell>
                      <TableCell>{rm.unit}</TableCell>
                      <TableCell className="text-right">{rm.stock_quantity}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!selected}>Select</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
