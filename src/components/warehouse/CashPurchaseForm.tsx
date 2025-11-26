import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";

interface Component {
  id: string;
  name: string;
  sku: string;
  unit: string;
  cost_per_unit: number | null;
}

interface Supplier {
  id: string;
  company_name: string;
  supplier_code: string;
}

export function CashPurchaseForm() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [warehouseLocation, setWarehouseLocation] = useState("MAIN");
  const [notes, setNotes] = useState("");

  // Fetch components for search
  const { data: components } = useQuery({
    queryKey: ["components", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("components")
        .select("*")
        .order("name");

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.limit(10);
      if (error) throw error;
      return data as Component[];
    },
  });

  // Fetch active suppliers
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, company_name, supplier_code")
        .eq("is_active", true)
        .order("company_name");

      if (error) throw error;
      return data as Supplier[];
    },
  });

  // Cash purchase mutation
  const cashPurchaseMutation = useMutation({
    mutationFn: async () => {
      if (!selectedComponent || !profile || !selectedSupplier) {
        throw new Error("Missing required data");
      }

      const qty = parseFloat(quantity);
      const price = parseFloat(unitPrice);

      if (isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
        throw new Error("Invalid quantity or price");
      }

      // Create stock movement
      const { data: movement, error: movementError } = await supabase
        .from("stock_movements")
        .insert({
          movement_type: "receipt",
          item_type: "component",
          item_id: selectedComponent.id,
          quantity: qty,
          unit_received: selectedComponent.unit,
          quantity_in_base_unit: qty,
          batch_number: batchNumber || null,
          warehouse_location: warehouseLocation,
          notes: notes || null,
          performed_by: profile.id,
          reference_type: "cash_purchase",
          supplier_reference: selectedSupplier,
        })
        .select()
        .single();

      if (movementError) throw movementError;

      // Sync to AutoCount as Purchase Invoice
      const { error: syncError } = await supabase.functions.invoke("sync-cash-purchase", {
        body: {
          movementId: movement.id,
          supplierId: selectedSupplier,
          componentId: selectedComponent.id,
          quantity: qty,
          unitPrice: price,
          batchNumber: batchNumber || null,
          warehouseLocation: warehouseLocation,
          notes: notes || null,
        },
      });

      if (syncError) {
        console.error("AutoCount sync error:", syncError);
      }

      return movement;
    },
    onSuccess: () => {
      toast({
        title: "Cash Purchase Recorded",
        description: "Stock has been received and synced to AutoCount.",
      });

      // Reset form
      setSelectedComponent(null);
      setSelectedSupplier("");
      setQuantity("");
      setUnitPrice("");
      setBatchNumber("");
      setNotes("");
      setSearchTerm("");

      queryClient.invalidateQueries({ queryKey: ["components"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleComponentSelect = (component: Component) => {
    setSelectedComponent(component);
    setSearchTerm(component.name);
    if (component.cost_per_unit) {
      setUnitPrice(component.cost_per_unit.toString());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    cashPurchaseMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Cash Purchase
        </CardTitle>
        <CardDescription>
          Record direct purchases without PO process
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Supplier Selection */}
          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier *</Label>
            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger id="supplier">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers?.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.company_name} ({supplier.supplier_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Component Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search Component *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchTerm && !selectedComponent && components && components.length > 0 && (
              <div className="border rounded-md p-2 space-y-1 max-h-48 overflow-y-auto">
                {components.map((component) => (
                  <button
                    key={component.id}
                    type="button"
                    onClick={() => handleComponentSelect(component)}
                    className="w-full text-left p-2 hover:bg-accent rounded-sm transition-colors"
                  >
                    <div className="font-medium">{component.name}</div>
                    <div className="text-sm text-muted-foreground">
                      SKU: {component.sku} | Unit: {component.unit}
                      {component.cost_per_unit && ` | Cost: $${component.cost_per_unit}`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Component Display */}
          {selectedComponent && (
            <div className="p-4 bg-accent/50 rounded-md space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-lg">{selectedComponent.name}</div>
                  <div className="text-sm text-muted-foreground">
                    SKU: {selectedComponent.sku}
                  </div>
                </div>
                <Badge variant="outline">
                  Unit: {selectedComponent.unit}
                </Badge>
              </div>
            </div>
          )}

          {selectedComponent && selectedSupplier && (
            <>
              {/* Quantity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                  />
                </div>

                {/* Unit Price */}
                <div className="space-y-2">
                  <Label htmlFor="unitPrice">Unit Price *</Label>
                  <Input
                    id="unitPrice"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Total Amount Display */}
              {quantity && unitPrice && (
                <div className="p-3 bg-primary/10 rounded-md">
                  <div className="text-sm text-muted-foreground">Total Amount</div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(parseFloat(quantity) * parseFloat(unitPrice))}
                  </div>
                </div>
              )}

              {/* Batch Number */}
              <div className="space-y-2">
                <Label htmlFor="batch">Batch/Lot Number</Label>
                <Input
                  id="batch"
                  placeholder="Optional"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                />
              </div>

              {/* Warehouse Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Warehouse Location *</Label>
                <Input
                  id="location"
                  placeholder="e.g., MAIN, ZONE-A"
                  value={warehouseLocation}
                  onChange={(e) => setWarehouseLocation(e.target.value)}
                  required
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Payment details, invoice reference, etc..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={!quantity || !unitPrice || cashPurchaseMutation.isPending}
              >
                {cashPurchaseMutation.isPending
                  ? "Processing..."
                  : "Record Cash Purchase & Sync to AutoCount"}
              </Button>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
