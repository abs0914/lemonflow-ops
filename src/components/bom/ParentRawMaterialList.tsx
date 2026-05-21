import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RawMaterial {
  id: string;
  sku: string;
  name: string;
  unit: string;
  stock_quantity: number;
}

interface Props {
  onSelect: (rm: RawMaterial) => void;
  selectedId?: string;
}

export function ParentRawMaterialList({ onSelect, selectedId }: Props) {
  const [search, setSearch] = useState("");

  const { data: rawMaterials = [], isLoading } = useQuery({
    queryKey: ["raw-materials-for-bom-parent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raw_materials")
        .select("id, sku, name, unit, stock_quantity")
        .order("name");
      if (error) throw error;
      return data as RawMaterial[];
    },
  });

  const filtered = rawMaterials.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Raw Materials</CardTitle>
        <p className="text-sm text-muted-foreground">
          Select a raw material to define a recipe for producing it (e.g. puree from fruit).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Search raw materials..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="border rounded-md">
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
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No raw materials found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((rm) => (
                  <TableRow
                    key={rm.id}
                    className={`cursor-pointer ${selectedId === rm.id ? "bg-accent" : ""}`}
                    onClick={() => onSelect(rm)}
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
      </CardContent>
    </Card>
  );
}
