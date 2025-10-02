import { useState } from "react";
import { Plus, Edit, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ComponentDialog } from "./ComponentDialog";
import { StockAdjustmentDialog } from "@/components/inventory/StockAdjustmentDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Component {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  unit: string;
  cost_per_unit: number | null;
  stock_quantity: number;
}

export function ComponentManager() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [adjustingComponent, setAdjustingComponent] = useState<Component | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: components = [], isLoading } = useQuery({
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("components").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["components"] });
      toast({ title: "Component deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting component",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredComponents = components.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (component: Component) => {
    setEditingComponent(component);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingComponent(null);
    setDialogOpen(true);
  };

  const handleAdjustStock = (component: Component) => {
    setAdjustingComponent(component);
    setStockDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Components Library</CardTitle>
          <Button onClick={handleAdd} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Component
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Search components..."
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
                <TableHead>Cost/Unit</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredComponents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No components found
                  </TableCell>
                </TableRow>
              ) : (
                filteredComponents.map((component) => (
                  <TableRow key={component.id}>
                    <TableCell className="font-medium">{component.sku}</TableCell>
                    <TableCell>{component.name}</TableCell>
                    <TableCell>{component.unit}</TableCell>
                    <TableCell>
                      {component.cost_per_unit 
                        ? `$${component.cost_per_unit.toFixed(2)}`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={component.stock_quantity <= 0 ? "text-destructive font-medium" : ""}>
                        {component.stock_quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleAdjustStock(component)}
                          title="Adjust Stock"
                        >
                          <Package className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(component)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Delete this component?")) {
                              deleteMutation.mutate(component.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <ComponentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          component={editingComponent}
        />

        {adjustingComponent && (
          <StockAdjustmentDialog
            open={stockDialogOpen}
            onOpenChange={setStockDialogOpen}
            itemType="component"
            itemId={adjustingComponent.id}
            itemName={adjustingComponent.name}
            currentStock={adjustingComponent.stock_quantity}
          />
        )}
      </CardContent>
    </Card>
  );
}