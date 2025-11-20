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
import { PackageX, Search } from "lucide-react";

interface Component {
  id: string;
  name: string;
  sku: string;
  unit: string;
  stock_quantity: number;
}

interface Supplier {
  id: string;
  supplier_code: string;
  company_name: string;
}

export function GoodsReturnForm() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch components for search
  const { data: components } = useQuery({
    queryKey: ["components", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("components")
        .select("*")
        .gt("stock_quantity", 0)
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
    queryKey: ["active-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("is_active", true)
        .order("company_name");

      if (error) throw error;
      return data as Supplier[];
    },
  });

  // Goods Return mutation
  const returnMutation = useMutation({
    mutationFn: async () => {
      if (!selectedComponent || !profile || !selectedSupplier) {
        throw new Error("Missing required data");
      }

      const qty = parseFloat(quantity);
      if (isNaN(qty) || qty <= 0) {
        throw new Error("Invalid quantity");
      }

      if (qty > selectedComponent.stock_quantity) {
        throw new Error("Return quantity exceeds available stock");
      }

      // Create negative stock movement for return
      const { error } = await supabase.from("stock_movements").insert({
        movement_type: "return",
        item_type: "component",
        item_id: selectedComponent.id,
        quantity: -qty, // Negative for return
        unit_received: selectedComponent.unit,
        quantity_in_base_unit: -qty,
        batch_number: batchNumber || null,
        notes: `Return to supplier. Reason: ${reason}. ${notes || ""}`.trim(),
        performed_by: profile.id,
        reference_type: "goods_return",
        supplier_reference: selectedSupplier,
      });

      if (error) throw error;

      // Call AutoCount sync edge function
      const { error: syncError } = await supabase.functions.invoke("sync-goods-return", {
        body: {
          supplierId: selectedSupplier,
          componentId: selectedComponent.id,
          quantity: qty,
          reason,
          batchNumber: batchNumber || null,
        },
      });

      if (syncError) {
        console.error("AutoCount sync error:", syncError);
      }
    },
    onSuccess: () => {
      toast({
        title: "Goods Return Recorded",
        description: "Return note has been created and synced to AutoCount.",
      });
      
      setSelectedComponent(null);
      setSelectedSupplier("");
      setQuantity("");
      setReason("");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    returnMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageX className="h-5 w-5" />
          Goods Return Note
        </CardTitle>
        <CardDescription>
          Return items to suppliers with debit note
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
                      setSearchTerm("");
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b last:border-b-0"
                  >
                    <div className="font-medium">{component.name}</div>
                    <div className="text-sm text-muted-foreground">
                      SKU: {component.sku} | Available: {component.stock_quantity} {component.unit}
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
              <div className="text-sm">
                <span className="text-muted-foreground">Available Stock:</span>
                <span className="ml-2 font-medium">{selectedComponent.stock_quantity} {selectedComponent.unit}</span>
              </div>
            </div>
          )}

          {selectedComponent && (
            <>
              {/* Supplier Selection */}
              <div className="space-y-2">
                <Label htmlFor="supplier">Return to Supplier</Label>
                <Select value={selectedSupplier} onValueChange={setSelectedSupplier} required>
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

              {/* Return Quantity */}
              <div className="space-y-2">
                <Label htmlFor="quantity">Return Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  max={selectedComponent.stock_quantity}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Unit: {selectedComponent.unit} | Max: {selectedComponent.stock_quantity}
                </p>
              </div>

              {/* Return Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">Return Reason</Label>
                <Select value={reason} onValueChange={setReason} required>
                  <SelectTrigger id="reason">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Defective">Defective / Quality Issue</SelectItem>
                    <SelectItem value="Wrong Item">Wrong Item Received</SelectItem>
                    <SelectItem value="Excess">Excess Quantity</SelectItem>
                    <SelectItem value="Damaged">Damaged in Transit</SelectItem>
                    <SelectItem value="Expired">Expired / Near Expiry</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional information about the return..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={!quantity || !selectedSupplier || !reason || returnMutation.isPending}
              >
                {returnMutation.isPending ? "Processing..." : "Record Goods Return & Sync to AutoCount"}
              </Button>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
