import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BomEditorProps {
  productId?: string;
  productName?: string;
}

interface BomItem {
  id: string;
  component_id: string;
  quantity: number;
  notes: string | null;
  components: {
    name: string;
    sku: string;
    unit: string;
    cost_per_unit: number | null;
  };
}

interface Component {
  id: string;
  name: string;
  sku: string;
  unit: string;
  cost_per_unit: number | null;
}

export function BomEditor({ productId, productName }: BomEditorProps) {
  const [selectedComponentId, setSelectedComponentId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bomItems = [] } = useQuery({
    queryKey: ["bom-items", productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from("bom_items")
        .select("*, components(*)")
        .eq("product_id", productId);
      
      if (error) throw error;
      return data as BomItem[];
    },
    enabled: !!productId,
  });

  const { data: components = [] } = useQuery({
    queryKey: ["components"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("components")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data as Component[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!productId || !selectedComponentId || !quantity) return;
      
      const { error } = await supabase.from("bom_items").insert([{
        product_id: productId,
        component_id: selectedComponentId,
        quantity: parseFloat(quantity),
        notes: notes || null,
      }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bom-items", productId] });
      toast({ title: "Component added to BOM" });
      setSelectedComponentId("");
      setQuantity("");
      setNotes("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding component",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bom_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bom-items", productId] });
      toast({ title: "Component removed from BOM" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing component",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const totalCost = bomItems.reduce((sum, item) => {
    const cost = item.components.cost_per_unit || 0;
    return sum + (cost * item.quantity);
  }, 0);

  if (!productId) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
          Select a product to edit its BOM
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>BOM for {productName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border rounded-md p-4 space-y-4">
          <h3 className="font-semibold">Add Component</h3>
          <div className="grid gap-4">
            <div>
              <Label>Component</Label>
              <Select value={selectedComponentId} onValueChange={setSelectedComponentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select component" />
                </SelectTrigger>
                <SelectContent>
                  {components.map((comp) => (
                    <SelectItem key={comp.id} value={comp.id}>
                      {comp.sku} - {comp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.000"
              />
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
              />
            </div>

            <Button
              onClick={() => addMutation.mutate()}
              disabled={!selectedComponentId || !quantity || addMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add to BOM
            </Button>
          </div>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Cost/Unit</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bomItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No components in BOM
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {bomItems.map((item) => {
                    const itemCost = (item.components.cost_per_unit || 0) * item.quantity;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.components.sku}</TableCell>
                        <TableCell>{item.components.name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.components.unit}</TableCell>
                        <TableCell>
                          {item.components.cost_per_unit 
                            ? `$${item.components.cost_per_unit.toFixed(2)}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {item.components.cost_per_unit 
                            ? `$${itemCost.toFixed(2)}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Remove this component from BOM?")) {
                                deleteMutation.mutate(item.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="font-bold">
                    <TableCell colSpan={5} className="text-right">Total Cost:</TableCell>
                    <TableCell>${totalCost.toFixed(2)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}