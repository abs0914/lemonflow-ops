import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { convertUnits, getAvailableUnits } from "@/lib/unitConversion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Search, ArrowRight } from "lucide-react";

interface Component {
  id: string;
  name: string;
  sku: string;
  unit: string;
  stock_quantity: number;
  reserved_quantity: number;
}

export function StockReceiptForm() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [quantity, setQuantity] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [convertedQuantity, setConvertedQuantity] = useState<number | null>(null);
  const [batchNumber, setBatchNumber] = useState("");
  const [supplierReference, setSupplierReference] = useState("");
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

  // Fetch available units
  const { data: availableUnits } = useQuery({
    queryKey: ["available-units"],
    queryFn: getAvailableUnits,
  });

  // Calculate converted quantity when quantity or unit changes
  useEffect(() => {
    if (selectedComponent && quantity && selectedUnit) {
      const qty = parseFloat(quantity);
      if (!isNaN(qty) && selectedUnit !== selectedComponent.unit) {
        convertUnits(qty, selectedUnit, selectedComponent.unit)
          .then(setConvertedQuantity)
          .catch(() => setConvertedQuantity(null));
      } else {
        setConvertedQuantity(qty);
      }
    } else {
      setConvertedQuantity(null);
    }
  }, [quantity, selectedUnit, selectedComponent]);

  // Stock receipt mutation
  const receiptMutation = useMutation({
    mutationFn: async () => {
      if (!selectedComponent || !profile || convertedQuantity === null) {
        throw new Error("Missing required data");
      }

      const { error } = await supabase.from("stock_movements").insert({
        movement_type: "receipt",
        item_type: "component",
        item_id: selectedComponent.id,
        quantity: convertedQuantity,
        unit_received: selectedUnit,
        quantity_in_base_unit: convertedQuantity,
        batch_number: batchNumber || null,
        supplier_reference: supplierReference || null,
        warehouse_location: warehouseLocation,
        notes: notes || null,
        performed_by: profile.id,
        reference_type: "supplier_receipt",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Stock Received",
        description: "Stock receipt has been recorded successfully.",
      });
      
      // Reset form
      setSelectedComponent(null);
      setQuantity("");
      setSelectedUnit("");
      setBatchNumber("");
      setSupplierReference("");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    receiptMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Stock Receipt
        </CardTitle>
        <CardDescription>
          Record incoming stock from suppliers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Component Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search Component</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by SKU or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {searchTerm && components && components.length > 0 && !selectedComponent && (
              <div className="border rounded-md bg-card max-h-60 overflow-y-auto">
                {components.map((component) => (
                  <button
                    key={component.id}
                    type="button"
                    onClick={() => {
                      setSelectedComponent(component);
                      setSelectedUnit(component.unit);
                      setSearchTerm("");
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b last:border-b-0"
                  >
                    <div className="font-medium">{component.name}</div>
                    <div className="text-sm text-muted-foreground">
                      SKU: {component.sku} | Stock: {component.stock_quantity} {component.unit}
                      {component.reserved_quantity > 0 && (
                        <span className="text-warning"> (Reserved: {component.reserved_quantity})</span>
                      )}
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
                  <div className="text-sm text-muted-foreground">SKU: {selectedComponent.sku}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedComponent(null)}
                >
                  Change
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Current Stock:</span>
                  <span className="ml-2 font-medium">{selectedComponent.stock_quantity} {selectedComponent.unit}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Available:</span>
                  <span className="ml-2 font-medium">
                    {selectedComponent.stock_quantity - selectedComponent.reserved_quantity} {selectedComponent.unit}
                  </span>
                </div>
              </div>
            </div>
          )}

          {selectedComponent && (
            <>
              {/* Quantity and Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity Received</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit} required>
                    <SelectTrigger id="unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUnits?.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Conversion Preview */}
              {convertedQuantity !== null && selectedUnit !== selectedComponent.unit && (
                <div className="flex items-center gap-2 text-sm p-3 bg-info/10 text-info-foreground rounded-md">
                  <span className="font-medium">{quantity} {selectedUnit}</span>
                  <ArrowRight className="h-4 w-4" />
                  <span className="font-medium">{convertedQuantity.toFixed(2)} {selectedComponent.unit}</span>
                </div>
              )}

              {/* Batch and Supplier Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="batch">Batch/Lot Number</Label>
                  <Input
                    id="batch"
                    placeholder="Optional"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier Reference</Label>
                  <Input
                    id="supplier"
                    placeholder="PO Number, Invoice, etc."
                    value={supplierReference}
                    onChange={(e) => setSupplierReference(e.target.value)}
                  />
                </div>
              </div>

              {/* Warehouse Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Warehouse Location</Label>
                <Input
                  id="location"
                  placeholder="e.g., MAIN, ZONE-A, SHELF-12"
                  value={warehouseLocation}
                  onChange={(e) => setWarehouseLocation(e.target.value)}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional information..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={!quantity || !selectedUnit || convertedQuantity === null || receiptMutation.isPending}
              >
                {receiptMutation.isPending ? "Recording..." : "Record Stock Receipt"}
              </Button>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
