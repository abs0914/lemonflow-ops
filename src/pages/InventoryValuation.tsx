import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface ComponentValuation {
  component_id: string;
  component_name: string;
  sku: string;
  total_stock: number;
  unit: string;
  avg_cost: number;
  total_value: number;
  batches: {
    batch_number: string;
    date_received: string;
    quantity: number;
    unit_cost: number;
    batch_value: number;
  }[];
}

export default function InventoryValuation() {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: valuations, isLoading } = useQuery({
    queryKey: ["inventory-valuation"],
    queryFn: async () => {
      // Get all components with stock
      const { data: components, error: compError } = await supabase
        .from("components")
        .select("id, name, sku, unit, stock_quantity")
        .gt("stock_quantity", 0)
        .order("name");

      if (compError) throw compError;

      const valuations: ComponentValuation[] = [];

      for (const component of components) {
        // Get all IN movements with unit_cost (FIFO ordering)
        const { data: movements, error: movError } = await supabase
          .from("stock_movements")
          .select("batch_number, created_at, quantity, unit_cost")
          .eq("item_id", component.id)
          .eq("movement_type", "in")
          .not("unit_cost", "is", null)
          .order("created_at", { ascending: true });

        if (movError) throw movError;

        if (!movements || movements.length === 0) continue;

        // Calculate remaining stock per batch using FIFO
        let remainingToAllocate = component.stock_quantity;
        const batches = [];
        let totalCostWeighted = 0;

        for (const movement of movements) {
          if (remainingToAllocate <= 0) break;

          const batchQty = Math.min(movement.quantity, remainingToAllocate);
          const unitCost = movement.unit_cost || 0;
          
          batches.push({
            batch_number: movement.batch_number || "N/A",
            date_received: movement.created_at,
            quantity: batchQty,
            unit_cost: unitCost,
            batch_value: batchQty * unitCost,
          });

          totalCostWeighted += batchQty * unitCost;
          remainingToAllocate -= batchQty;
        }

        const avgCost = component.stock_quantity > 0 ? totalCostWeighted / component.stock_quantity : 0;

        valuations.push({
          component_id: component.id,
          component_name: component.name,
          sku: component.sku,
          total_stock: component.stock_quantity,
          unit: component.unit,
          avg_cost: avgCost,
          total_value: totalCostWeighted,
          batches,
        });
      }

      return valuations;
    },
  });

  const toggleRow = (componentId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(componentId)) {
      newExpanded.delete(componentId);
    } else {
      newExpanded.add(componentId);
    }
    setExpandedRows(newExpanded);
  };

  const grandTotal = valuations?.reduce((sum, v) => sum + v.total_value, 0) || 0;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Inventory Valuation</h1>
            <p className="text-muted-foreground">FIFO-based inventory valuation by component and batch</p>
          </div>
          <Card className="w-64">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-5 w-5 text-primary" />
                <p className="text-sm text-muted-foreground">Total Inventory Value</p>
              </div>
              <p className="text-3xl font-bold">${grandTotal.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Component Valuation</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Component</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Total Stock</TableHead>
                  <TableHead className="text-right">Avg Cost</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {valuations?.map((valuation) => (
                  <>
                    <TableRow
                      key={valuation.component_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleRow(valuation.component_id)}
                    >
                      <TableCell>
                        {expandedRows.has(valuation.component_id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{valuation.component_name}</TableCell>
                      <TableCell className="font-mono text-sm">{valuation.sku}</TableCell>
                      <TableCell className="text-right">
                        {valuation.total_stock} {valuation.unit}
                      </TableCell>
                      <TableCell className="text-right">${valuation.avg_cost.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold">${valuation.total_value.toFixed(2)}</TableCell>
                    </TableRow>
                    {expandedRows.has(valuation.component_id) && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/20">
                          <div className="py-2 px-4">
                            <p className="text-sm font-semibold mb-2">Batch Breakdown (FIFO)</p>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Batch Number</TableHead>
                                  <TableHead>Date Received</TableHead>
                                  <TableHead className="text-right">Quantity</TableHead>
                                  <TableHead className="text-right">Unit Cost</TableHead>
                                  <TableHead className="text-right">Batch Value</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {valuation.batches.map((batch, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-mono text-sm">{batch.batch_number}</TableCell>
                                    <TableCell>{format(new Date(batch.date_received), "dd/MM/yyyy")}</TableCell>
                                    <TableCell className="text-right">{batch.quantity}</TableCell>
                                    <TableCell className="text-right">${batch.unit_cost.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-medium">
                                      ${batch.batch_value.toFixed(2)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
