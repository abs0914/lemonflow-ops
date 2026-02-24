import { useState } from "react";
import { Plus, Trash2, Check, ChevronsUpDown, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { ConversionHelper } from "./ConversionHelper";
import { AddFromRawMaterialDialog } from "./AddFromRawMaterialDialog";

interface BomEditorProps {
  productId?: string;
  productName?: string;
}

interface BomItem {
  id: string;
  item_type: string;
  raw_material_id: string | null;
  component_id: string | null;
  quantity: number;
  notes: string | null;
  raw_materials: {
    name: string;
    sku: string;
    unit: string;
    cost_per_unit: number | null;
  } | null;
  components: {
    name: string;
    sku: string;
    unit: string;
    cost_per_unit: number | null;
  } | null;
}

interface SelectableItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  cost_per_unit: number | null;
  source: 'raw_material' | 'component';
}

export function BomEditor({ productId, productName }: BomEditorProps) {
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedItemType, setSelectedItemType] = useState<"raw_material" | "component">("raw_material");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);
  const [itemTypeFilter, setItemTypeFilter] = useState<"all" | "raw_material" | "component">("all");
  const [addFromRmOpen, setAddFromRmOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bomItems = [] } = useQuery({
    queryKey: ["bom-items", productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from("bom_items")
        .select("*, raw_materials(*), components(*)")
        .eq("product_id", productId);
      
      if (error) throw error;
      return data as BomItem[];
    },
    enabled: !!productId,
  });

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ["raw-materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raw_materials")
        .select("id, name, sku, unit, cost_per_unit")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: components = [] } = useQuery({
    queryKey: ["components-for-bom"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("components")
        .select("id, name, sku, unit, cost_per_unit")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Merge both lists into a unified selectable list
  const allItems: SelectableItem[] = [
    ...rawMaterials.map(rm => ({ ...rm, source: 'raw_material' as const })),
    ...components.map(c => ({ ...c, source: 'component' as const })),
  ].filter(item => itemTypeFilter === "all" || item.source === itemTypeFilter);

  const selectedItem = allItems.find(i => i.id === selectedItemId);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!productId || !selectedItemId || !quantity || !selectedItem) return;
      
      const insertData = {
        product_id: productId,
        quantity: parseFloat(quantity),
        notes: notes || null,
        item_type: selectedItem.source,
        raw_material_id: selectedItem.source === 'raw_material' ? selectedItemId : null,
        component_id: selectedItem.source === 'component' ? selectedItemId : null,
      };

      const { error } = await supabase.from("bom_items").insert([insertData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bom-items", productId] });
      toast({ title: "Item added to BOM" });
      setSelectedItemId("");
      setQuantity("");
      setNotes("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding item",
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
      toast({ title: "Item removed from BOM" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getItemDetails = (item: BomItem) => {
    if (item.item_type === 'component' && item.components) return item.components;
    if (item.raw_materials) return item.raw_materials;
    return { name: 'Unknown', sku: '-', unit: '-', cost_per_unit: null };
  };

  const totalCost = bomItems.reduce((sum, item) => {
    const details = getItemDetails(item);
    const cost = details.cost_per_unit || 0;
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
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Add Item</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddFromRmOpen(true)}
              className="gap-1"
            >
              <FlaskConical className="h-4 w-4" />
              Add from Raw Materials
            </Button>
          </div>
          <div className="grid gap-4">
            <div>
              <Label>Item Type Filter</Label>
              <Select value={itemTypeFilter} onValueChange={(v) => { setItemTypeFilter(v as typeof itemTypeFilter); setSelectedItemId(""); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="raw_material">Raw Materials Only</SelectItem>
                  <SelectItem value="component">Inventory Items Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Item</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                  >
                    {selectedItem
                      ? `${selectedItem.sku} - ${selectedItem.name}`
                      : "Select item..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by SKU or name..." />
                    <CommandList>
                      <CommandEmpty>No item found.</CommandEmpty>
                      <CommandGroup heading="Raw Materials">
                        {allItems.filter(i => i.source === 'raw_material').map((item) => (
                          <CommandItem
                            key={`rm-${item.id}`}
                            value={`${item.sku} ${item.name} ${item.id}`}
                            onSelect={() => {
                              setSelectedItemId(item.id);
                              setOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedItemId === item.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span className="font-medium">{item.sku} - {item.name}</span>
                              <span className="text-xs text-muted-foreground">
                                Raw Material • Unit: {item.unit} {item.cost_per_unit && `• Cost: RM ${item.cost_per_unit}`}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      <CommandGroup heading="Inventory Items">
                        {allItems.filter(i => i.source === 'component').map((item) => (
                          <CommandItem
                            key={`comp-${item.id}`}
                            value={`${item.sku} ${item.name} ${item.id}`}
                            onSelect={() => {
                              setSelectedItemId(item.id);
                              setOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedItemId === item.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span className="font-medium">{item.sku} - {item.name}</span>
                              <span className="text-xs text-muted-foreground">
                                Inventory Item • Unit: {item.unit} {item.cost_per_unit && `• Cost: RM ${item.cost_per_unit}`}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>
                Quantity
                {selectedItem && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({selectedItem.unit})
                  </span>
                )}
              </Label>
              <Input
                type="number"
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.000"
              />
              {selectedItem && (
                <ConversionHelper
                  baseUnit={selectedItem.unit}
                  onApply={(value) => setQuantity(value)}
                />
              )}
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
              disabled={!selectedItemId || !quantity || addMutation.isPending}
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
                <TableHead>Type</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Item</TableHead>
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
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No items in BOM
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {bomItems.map((item) => {
                    const details = getItemDetails(item);
                    const itemCost = (details.cost_per_unit || 0) * item.quantity;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            item.item_type === 'component' 
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
                              : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          )}>
                            {item.item_type === 'component' ? 'Inventory' : 'Raw Mat'}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{details.sku}</TableCell>
                        <TableCell>{details.name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{details.unit}</TableCell>
                        <TableCell>
                          {details.cost_per_unit 
                            ? formatCurrency(details.cost_per_unit)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {details.cost_per_unit 
                            ? formatCurrency(itemCost)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Remove this item from BOM?")) {
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
                    <TableCell colSpan={6} className="text-right">Total Cost:</TableCell>
                    <TableCell>{formatCurrency(totalCost)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <AddFromRawMaterialDialog
        open={addFromRmOpen}
        onOpenChange={setAddFromRmOpen}
        productId={productId}
      />
    </Card>
  );
}
