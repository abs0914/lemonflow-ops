import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { 
  Package, 
  ClipboardCheck, 
  Check,
  Loader2,
  AlertCircle
} from "lucide-react";

interface POLine {
  id: string;
  line_number: number;
  component_id: string | null;
  raw_material_id: string | null;
  item_type: string;
  quantity: number;
  unit_price: number;
  uom: string;
  components: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    autocount_item_code: string | null;
  } | null;
  raw_materials: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    autocount_item_code: string | null;
  } | null;
  // Local state for form
  selected?: boolean;
  quantityReceived?: string;
  batchNumber?: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  doc_date: string;
  is_cash_purchase: boolean | null;
  suppliers: {
    company_name: string;
    supplier_code: string;
  };
}

export function EnhancedGoodsReceivedForm() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPO, setSelectedPO] = useState<string>("");
  const [warehouseLocation, setWarehouseLocation] = useState("MAIN");
  const [lines, setLines] = useState<POLine[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // Fetch approved purchase orders
  const { data: purchaseOrders } = useQuery({
    queryKey: ["approved-pos-for-receiving"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          id,
          po_number,
          doc_date,
          is_cash_purchase,
          suppliers(company_name, supplier_code)
        `)
        .eq("status", "approved")
        .or("goods_received.is.null,goods_received.eq.false")
        .order("doc_date", { ascending: false });

      if (error) throw error;
      return data as PurchaseOrder[];
    },
  });

  // Fetch PO lines when PO is selected
  const { data: poLines, isLoading: linesLoading } = useQuery({
    queryKey: ["po-lines-for-receiving", selectedPO],
    queryFn: async () => {
      if (!selectedPO) return [];

      const { data, error } = await supabase
        .from("purchase_order_lines")
        .select(`
          id,
          line_number,
          component_id,
          raw_material_id,
          item_type,
          quantity,
          unit_price,
          uom,
          components(id, name, sku, unit, autocount_item_code),
          raw_materials(id, name, sku, unit, autocount_item_code)
        `)
        .eq("purchase_order_id", selectedPO)
        .order("line_number");

      if (error) throw error;
      return data as POLine[];
    },
    enabled: !!selectedPO,
  });

  // Fetch already received quantities
  const { data: receivedData } = useQuery({
    queryKey: ["received-quantities", selectedPO],
    queryFn: async () => {
      if (!selectedPO) return {};

      const { data, error } = await supabase
        .from("stock_movements")
        .select("reference_id, quantity")
        .eq("purchase_order_id", selectedPO)
        .eq("movement_type", "receipt");

      if (error) throw error;

      // Sum quantities by reference_id (line id)
      const received: Record<string, number> = {};
      data?.forEach((m) => {
        if (m.reference_id) {
          received[m.reference_id] = (received[m.reference_id] || 0) + m.quantity;
        }
      });
      return received;
    },
    enabled: !!selectedPO,
  });

  // Update lines state when PO lines change
  useEffect(() => {
    if (poLines) {
      setLines(
        poLines.map((line) => ({
          ...line,
          selected: false,
          quantityReceived: "",
          batchNumber: "",
        }))
      );
      setSelectAll(false);
    }
  }, [poLines]);

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setLines((prev) =>
      prev.map((line) => ({
        ...line,
        selected: checked,
        quantityReceived: checked ? String(line.quantity - (receivedData?.[line.id] || 0)) : "",
      }))
    );
  };

  // Handle line selection
  const handleLineSelect = (lineId: string, checked: boolean) => {
    setLines((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              selected: checked,
              quantityReceived: checked
                ? String(line.quantity - (receivedData?.[line.id] || 0))
                : "",
            }
          : line
      )
    );
  };

  // Handle quantity change
  const handleQuantityChange = (lineId: string, value: string) => {
    setLines((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, quantityReceived: value } : line
      )
    );
  };

  // Handle batch number change
  const handleBatchChange = (lineId: string, value: string) => {
    setLines((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, batchNumber: value } : line
      )
    );
  };

  // Receive mutation
  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Not authenticated");

      const selectedLines = lines.filter(
        (line) => line.selected && parseFloat(line.quantityReceived || "0") > 0
      );

      if (selectedLines.length === 0) {
        throw new Error("No items selected for receiving");
      }

      // Create stock movements for each selected line
      const movements = selectedLines.map((line) => {
        const itemId = line.item_type === "raw_material" 
          ? line.raw_material_id 
          : line.component_id;
        
        return {
          movement_type: "receipt",
          item_type: line.item_type === "raw_material" ? "raw_material" : "component",
          item_id: itemId,
          quantity: parseFloat(line.quantityReceived || "0"),
          unit_received: line.uom,
          quantity_in_base_unit: parseFloat(line.quantityReceived || "0"),
          batch_number: line.batchNumber || null,
          warehouse_location: warehouseLocation,
          performed_by: profile.id,
          reference_type: "purchase_order_line",
          reference_id: line.id,
          purchase_order_id: selectedPO,
        };
      });

      const { error } = await supabase.from("stock_movements").insert(movements);
      if (error) throw error;

      // Sync each movement to AutoCount
      for (const line of selectedLines) {
        const itemId = line.item_type === "raw_material" 
          ? line.raw_material_id 
          : line.component_id;

        try {
          await supabase.functions.invoke("sync-grn-to-autocount", {
            body: {
              purchaseOrderId: selectedPO,
              itemId,
              itemType: line.item_type,
              quantity: parseFloat(line.quantityReceived || "0"),
              batchNumber: line.batchNumber || null,
              warehouseLocation,
            },
          });
        } catch (syncError) {
          console.error("AutoCount sync error for line:", line.id, syncError);
        }
      }

      return selectedLines.length;
    },
    onSuccess: (count) => {
      toast({
        title: "Goods Received",
        description: `${count} item(s) received and recorded successfully.`,
      });

      // Reset form
      setSelectedPO("");
      setLines([]);
      setSelectAll(false);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["pending-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["incoming-inventory-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["components"] });
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
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

  const selectedCount = lines.filter((l) => l.selected).length;
  const poOptions = purchaseOrders?.map((po) => ({
    value: po.id,
    label: `${po.po_number} - ${po.suppliers?.company_name}`,
  })) || [];

  const selectedPOData = purchaseOrders?.find((po) => po.id === selectedPO);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          Receive Goods
        </CardTitle>
        <CardDescription>
          Select a purchase order and receive goods for one or multiple line items
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* PO Selection */}
        <div className="space-y-2">
          <Label>Purchase Order</Label>
          <SearchableSelect
            options={poOptions}
            value={selectedPO}
            onValueChange={setSelectedPO}
            placeholder="Select a purchase order"
            searchPlaceholder="Search PO number or supplier..."
            emptyMessage="No approved purchase orders found"
          />
        </div>

        {/* PO Info */}
        {selectedPOData && (
          <div className="p-4 bg-accent/50 rounded-lg flex items-center justify-between">
            <div>
              <div className="font-semibold">{selectedPOData.po_number}</div>
              <div className="text-sm text-muted-foreground">
                {selectedPOData.suppliers?.company_name}
              </div>
            </div>
            <Badge variant={selectedPOData.is_cash_purchase ? "secondary" : "outline"}>
              {selectedPOData.is_cash_purchase ? "Cash Purchase" : "Credit Purchase"}
            </Badge>
          </div>
        )}

        {/* Warehouse Location */}
        {selectedPO && (
          <div className="space-y-2">
            <Label htmlFor="location">Warehouse Location</Label>
            <Input
              id="location"
              placeholder="e.g., MAIN, ZONE-A"
              value={warehouseLocation}
              onChange={(e) => setWarehouseLocation(e.target.value)}
            />
          </div>
        )}

        {/* Loading */}
        {linesLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2">Loading items...</span>
          </div>
        )}

        {/* Lines Table */}
        {selectedPO && lines.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="selectAll"
                  checked={selectAll}
                  onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                />
                <Label htmlFor="selectAll" className="text-sm font-medium">
                  Select All ({lines.length} items)
                </Label>
              </div>
              {selectedCount > 0 && (
                <Badge variant="secondary">{selectedCount} selected</Badge>
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block border rounded-lg">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Ordered</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead>Qty to Receive</TableHead>
                      <TableHead>Batch No.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => {
                      const item = line.item_type === "raw_material" 
                        ? line.raw_materials 
                        : line.components;
                      const alreadyReceived = receivedData?.[line.id] || 0;
                      const remaining = line.quantity - alreadyReceived;

                      return (
                        <TableRow key={line.id}>
                          <TableCell>
                            <Checkbox
                              checked={line.selected}
                              onCheckedChange={(checked) =>
                                handleLineSelect(line.id, checked as boolean)
                              }
                              disabled={remaining <= 0}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item?.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {item?.sku}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={
                                line.item_type === "raw_material"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              }
                            >
                              {line.item_type === "raw_material" ? "Raw" : "Inv"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {line.quantity} {line.uom}
                          </TableCell>
                          <TableCell className="text-right">
                            {alreadyReceived > 0 ? (
                              <span className="text-emerald-600">{alreadyReceived}</span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {remaining > 0 ? (
                              <span className="font-medium">{remaining}</span>
                            ) : (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                                <Check className="h-3 w-3 mr-1" />
                                Complete
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max={remaining}
                              placeholder="0"
                              value={line.quantityReceived}
                              onChange={(e) => handleQuantityChange(line.id, e.target.value)}
                              disabled={!line.selected || remaining <= 0}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="Optional"
                              value={line.batchNumber}
                              onChange={(e) => handleBatchChange(line.id, e.target.value)}
                              disabled={!line.selected || remaining <= 0}
                              className="w-28"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {lines.map((line) => {
                const item = line.item_type === "raw_material" 
                  ? line.raw_materials 
                  : line.components;
                const alreadyReceived = receivedData?.[line.id] || 0;
                const remaining = line.quantity - alreadyReceived;

                return (
                  <Card key={line.id} className={line.selected ? "ring-2 ring-primary" : ""}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={line.selected}
                            onCheckedChange={(checked) =>
                              handleLineSelect(line.id, checked as boolean)
                            }
                            disabled={remaining <= 0}
                          />
                          <div>
                            <div className="font-medium">{item?.name}</div>
                            <div className="text-sm text-muted-foreground">{item?.sku}</div>
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={
                            line.item_type === "raw_material"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }
                        >
                          {line.item_type === "raw_material" ? "Raw" : "Inv"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Ordered:</span>
                          <div className="font-medium">{line.quantity} {line.uom}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Received:</span>
                          <div className="font-medium text-emerald-600">{alreadyReceived}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Remaining:</span>
                          <div className="font-medium">{remaining}</div>
                        </div>
                      </div>

                      {line.selected && remaining > 0 && (
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                          <div className="space-y-1">
                            <Label className="text-xs">Qty to Receive</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max={remaining}
                              placeholder="0"
                              value={line.quantityReceived}
                              onChange={(e) => handleQuantityChange(line.id, e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Batch No.</Label>
                            <Input
                              placeholder="Optional"
                              value={line.batchNumber}
                              onChange={(e) => handleBatchChange(line.id, e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Submit Button */}
            <Button
              onClick={() => receiveMutation.mutate()}
              disabled={selectedCount === 0 || receiveMutation.isPending}
              className="w-full"
              size="lg"
            >
              {receiveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Receive {selectedCount} Item{selectedCount !== 1 ? "s" : ""} & Sync to AutoCount
                </>
              )}
            </Button>
          </div>
        )}

        {/* Empty State */}
        {selectedPO && !linesLoading && lines.length === 0 && (
          <div className="text-center py-8">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No line items found for this purchase order</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
