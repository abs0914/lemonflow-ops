import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Component } from "@/types/inventory";

interface SelectComponentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SelectComponentDialog({ open, onOpenChange }: SelectComponentDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: components = [], isLoading } = useQuery({
    queryKey: ["available-components-for-products"],
    queryFn: async () => {
      // Get components that are not already linked to products
      const { data: products } = await supabase
        .from("products")
        .select("component_id")
        .not("component_id", "is", null);
      
      const usedComponentIds = products?.map(p => p.component_id) || [];
      
      const { data, error } = await supabase
        .from("components")
        .select("*")
        .order("name");
      
      if (error) throw error;
      
      // Filter out components already used as products
      return (data as Component[]).filter(c => !usedComponentIds.includes(c.id));
    },
    enabled: open,
  });

  const createProductMutation = useMutation({
    mutationFn: async (component: Component) => {
      const { error } = await supabase.from("products").insert({
        component_id: component.id,
        sku: component.sku,
        name: component.name,
        description: component.description,
        unit: component.unit,
        stock_quantity: component.stock_quantity,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["available-components-for-products"] });
      toast({ title: "Product created from inventory component" });
      onOpenChange(false);
      setSelectedComponent(null);
      setSearch("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredComponents = components.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (selectedComponent) {
      createProductMutation.mutate(selectedComponent);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Component from Inventory</DialogTitle>
          <DialogDescription>
            Choose an inventory component to create a product for BOM management.
            Only components not already used as products are shown.
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
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredComponents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No available components found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredComponents.map((component) => (
                    <TableRow
                      key={component.id}
                      className={`cursor-pointer ${
                        selectedComponent?.id === component.id ? "bg-accent" : ""
                      }`}
                      onClick={() => setSelectedComponent(component)}
                    >
                      <TableCell className="font-medium">{component.sku}</TableCell>
                      <TableCell>{component.name}</TableCell>
                      <TableCell>{component.unit}</TableCell>
                      <TableCell className="text-right">{component.stock_quantity}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selectedComponent || createProductMutation.isPending}
          >
            Create Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
