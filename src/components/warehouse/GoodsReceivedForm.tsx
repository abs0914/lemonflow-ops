import { useState, useEffect } from "react";
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
import { Package, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PurchaseOrder {
  id: string;
  po_number: string;
  doc_date: string;
  suppliers: {
    company_name: string;
  };
}

interface POLine {
  id: string;
  component_id: string;
  quantity: number;
  uom: string;
  components: {
    name: string;
    sku: string;
    unit: string;
  };
}

export function GoodsReceivedForm() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPO, setSelectedPO] = useState<string>("");
  const [selectedLine, setSelectedLine] = useState<string>("");
  const [quantityReceived, setQuantityReceived] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [warehouseLocation, setWarehouseLocation] = useState("MAIN");
  const [notes, setNotes] = useState("");

  // Fetch approved purchase orders
  const { data: purchaseOrders } = useQuery({
    queryKey: ["approved-pos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          id,
          po_number,
          doc_date,
          suppliers(company_name)
        `)
        .eq("status", "approved")
        .order("doc_date", { ascending: false });

      if (error) throw error;
      return data as PurchaseOrder[];
    },
  });

  // Fetch PO lines
  const { data: poLines } = useQuery({
    queryKey: ["po-lines", selectedPO],
    queryFn: async () => {
      if (!selectedPO) return [];

      const { data, error } = await supabase
        .from("purchase_order_lines")
        .select(`
          id,
          component_id,
          quantity,
          uom,
          components(name, sku, unit)
        `)
        .eq("purchase_order_id", selectedPO)
        .order("line_number");

      if (error) throw error;
      return data as POLine[];
    },
    enabled: !!selectedPO,
  });

  const selectedLineData = poLines?.find(line => line.id === selectedLine);

  // GRN mutation
  const grnMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLineData || !profile) {
        throw new Error("Missing required data");
      }

      const qty = parseFloat(quantityReceived);
      if (isNaN(qty) || qty <= 0) {
        throw new Error("Invalid quantity");
      }

      const { error } = await supabase.from("stock_movements").insert({
        movement_type: "receipt",
        item_type: "component",
        item_id: selectedLineData.component_id,
        quantity: qty,
        unit_received: selectedLineData.uom,
        quantity_in_base_unit: qty,
        batch_number: batchNumber || null,
        warehouse_location: warehouseLocation,
        notes: notes || null,
        performed_by: profile.id,
        reference_type: "purchase_order",
        reference_id: selectedLine,
        purchase_order_id: selectedPO,
      });

      if (error) throw error;

      // Call AutoCount sync edge function
      const { error: syncError } = await supabase.functions.invoke("sync-grn-to-autocount", {
        body: {
          purchaseOrderId: selectedPO,
          componentId: selectedLineData.component_id,
          quantity: qty,
          batchNumber: batchNumber || null,
          warehouseLocation: warehouseLocation,
        },
      });

      if (syncError) {
        console.error("AutoCount sync error:", syncError);
      }
    },
    onSuccess: () => {
      toast({
        title: "Goods Received",
        description: "GRN has been recorded and synced to AutoCount.",
      });
      
      setSelectedPO("");
      setSelectedLine("");
      setQuantityReceived("");
      setBatchNumber("");
      setNotes("");
      
      queryClient.invalidateQueries({ queryKey: ["components"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["approved-pos"] });
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
    grnMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Goods Received Note (GRN)
        </CardTitle>
        <CardDescription>
          Receive goods from approved purchase orders
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Purchase Order Selection */}
          <div className="space-y-2">
            <Label htmlFor="po">Purchase Order</Label>
            <Select value={selectedPO} onValueChange={setSelectedPO}>
              <SelectTrigger id="po">
                <SelectValue placeholder="Select a PO" />
              </SelectTrigger>
              <SelectContent>
                {purchaseOrders?.map((po) => (
                  <SelectItem key={po.id} value={po.id}>
                    {po.po_number} - {po.suppliers.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* PO Line Selection */}
          {selectedPO && poLines && poLines.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="line">Item to Receive</Label>
              <Select value={selectedLine} onValueChange={setSelectedLine}>
                <SelectTrigger id="line">
                  <SelectValue placeholder="Select an item" />
                </SelectTrigger>
                <SelectContent>
                  {poLines.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.components.name} (SKU: {line.components.sku}) - Qty: {line.quantity} {line.uom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Selected Line Details */}
          {selectedLineData && (
            <div className="p-4 bg-accent/50 rounded-md space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-lg">{selectedLineData.components.name}</div>
                  <div className="text-sm text-muted-foreground">SKU: {selectedLineData.components.sku}</div>
                </div>
                <Badge variant="outline">
                  PO Qty: {selectedLineData.quantity} {selectedLineData.uom}
                </Badge>
              </div>
            </div>
          )}

          {selectedLineData && (
            <>
              {/* Quantity Received */}
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity Received</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={quantityReceived}
                  onChange={(e) => setQuantityReceived(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Unit: {selectedLineData.uom}
                </p>
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

              {/* Warehouse Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Warehouse Location</Label>
                <Input
                  id="location"
                  placeholder="e.g., MAIN, ZONE-A"
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
                disabled={!quantityReceived || grnMutation.isPending}
              >
                {grnMutation.isPending ? "Recording..." : "Record GRN & Sync to AutoCount"}
              </Button>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
