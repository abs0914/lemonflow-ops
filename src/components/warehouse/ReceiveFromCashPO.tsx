import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateBatchNumber } from "@/hooks/useBatchNumber";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { PurchaseOrderLine } from "@/types/inventory";
import { formatCurrency } from "@/lib/currency";

interface ReceiveFromCashPOProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string;
  poNumber: string;
  lines: PurchaseOrderLine[];
}

interface ReceiveLine {
  component_id: string;
  component_name: string;
  quantity: number;
  unit_cost: number;
  uom: string;
  batch_number: string;
}

export function ReceiveFromCashPO({
  open,
  onOpenChange,
  purchaseOrderId,
  poNumber,
  lines,
}: ReceiveFromCashPOProps) {
  const queryClient = useQueryClient();
  const [receiveLines, setReceiveLines] = useState<ReceiveLine[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateBatchNumbers = async () => {
    setIsGenerating(true);
    try {
      const newLines = await Promise.all(
        lines.map(async (line) => ({
          component_id: line.component_id,
          component_name: line.components?.name || "",
          quantity: line.quantity,
          unit_cost: line.unit_price,
          uom: line.uom,
          batch_number: await generateBatchNumber(),
        }))
      );
      setReceiveLines(newLines);
    } catch (error) {
      toast.error("Failed to generate batch numbers");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  useState(() => {
    if (open && lines.length > 0 && receiveLines.length === 0) {
      generateBatchNumbers();
    }
  });

  const receiveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create stock movements for each line
      const movements = receiveLines.map((line) => ({
        item_id: line.component_id,
        item_type: "component",
        movement_type: "in",
        quantity: line.quantity,
        unit_cost: line.unit_cost,
        total_cost: line.quantity * line.unit_cost,
        batch_number: line.batch_number,
        warehouse_location: "MAIN",
        purchase_order_id: purchaseOrderId,
        performed_by: user.id,
        notes: `Received from Cash PO ${poNumber}`,
      }));

      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert(movements);

      if (movementError) throw movementError;

      // Update component stock quantities
      for (const line of receiveLines) {
        const { data: component } = await supabase
          .from("components")
          .select("stock_quantity")
          .eq("id", line.component_id)
          .single();

        if (component) {
          await supabase
            .from("components")
            .update({ stock_quantity: component.stock_quantity + line.quantity })
            .eq("id", line.component_id);
        }
      }

      // Mark PO as goods received
      const { error: poError } = await supabase
        .from("purchase_orders")
        .update({
          goods_received: true,
          received_at: new Date().toISOString(),
          received_by: user.id,
        })
        .eq("id", purchaseOrderId);

      if (poError) throw poError;

      // Sync to AutoCount
      await supabase.functions.invoke("sync-cash-purchase", {
        body: {
          purchaseOrderId,
          lines: receiveLines.map((line, index) => ({
            componentId: line.component_id,
            quantity: line.quantity,
            unitCost: line.unit_cost,
            batchNumber: line.batch_number,
            lineNumber: index + 1,
          })),
        },
      });
    },
    onSuccess: () => {
      toast.success("Goods received successfully");
      queryClient.invalidateQueries({ queryKey: ["purchase-order", purchaseOrderId] });
      queryClient.invalidateQueries({ queryKey: ["components"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Failed to receive goods: ${error.message}`);
      console.error(error);
    },
  });

  const updateLine = (index: number, field: keyof ReceiveLine, value: any) => {
    const newLines = [...receiveLines];
    newLines[index] = { ...newLines[index], [field]: value };
    setReceiveLines(newLines);
  };

  const totalAmount = receiveLines.reduce(
    (sum, line) => sum + line.quantity * line.unit_cost,
    0
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Receive Goods - {poNumber}</SheetTitle>
          <SheetDescription>
            Confirm quantities and costs for received items. Batch numbers are auto-generated.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isGenerating ? (
            <div className="flex justify-center py-8">
              <p className="text-muted-foreground">Generating batch numbers...</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead className="w-24">Quantity</TableHead>
                    <TableHead className="w-32">Unit Cost</TableHead>
                    <TableHead>Batch Number</TableHead>
                    <TableHead className="w-32 text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receiveLines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{line.component_name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(index, "quantity", parseFloat(e.target.value) || 0)
                          }
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_cost}
                          onChange={(e) =>
                            updateLine(index, "unit_cost", parseFloat(e.target.value) || 0)
                          }
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{line.batch_number}</span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(line.quantity * line.unit_cost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator />

              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
                </div>
              </div>
            </>
          )}
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => receiveMutation.mutate()}
            disabled={receiveMutation.isPending || isGenerating || receiveLines.length === 0}
          >
            {receiveMutation.isPending ? "Processing..." : "Confirm Receipt"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
