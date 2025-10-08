import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Package, CheckCircle, Clock } from "lucide-react";

interface StockReceipt {
  id: string;
  quantity: number;
  unit_received: string | null;
  quantity_in_base_unit: number | null;
  batch_number: string | null;
  supplier_reference: string | null;
  warehouse_location: string | null;
  autocount_synced: boolean;
  autocount_doc_no: string | null;
  created_at: string;
  notes: string | null;
  components?: {
    name: string;
    sku: string;
    unit: string;
  } | null;
  user_profiles?: {
    full_name: string;
  } | null;
}

export function RecentReceipts() {
  const { data: receipts, isLoading } = useQuery({
    queryKey: ["stock-receipts"],
    queryFn: async () => {
      const { data: movements, error } = await supabase
        .from("stock_movements")
        .select(`
          *,
          components(name, sku, unit)
        `)
        .eq("movement_type", "receipt")
        .eq("item_type", "component")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch user profiles separately
      const userIds = [...new Set(movements?.map(m => m.performed_by) || [])];
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return movements?.map(movement => ({
        ...movement,
        user_profiles: profileMap.get(movement.performed_by),
      })) as unknown as StockReceipt[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Loading receipts...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Recent Stock Receipts
        </CardTitle>
        <CardDescription>
          Last 50 stock receipts from suppliers
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!receipts || receipts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No stock receipts recorded yet</p>
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Component</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Supplier Ref</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Received By</TableHead>
                  <TableHead>AutoCount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell className="font-medium">
                      {format(new Date(receipt.created_at), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{receipt.components?.name || "Unknown"}</div>
                      {receipt.notes && (
                        <div className="text-xs text-muted-foreground mt-1">{receipt.notes}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {receipt.components?.sku || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium">
                        {receipt.quantity} {receipt.unit_received || receipt.components?.unit}
                      </div>
                      {receipt.unit_received && receipt.unit_received !== receipt.components?.unit && (
                        <div className="text-xs text-muted-foreground">
                          ({receipt.quantity_in_base_unit?.toFixed(2)} {receipt.components?.unit})
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {receipt.batch_number ? (
                        <span className="font-mono text-sm">{receipt.batch_number}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {receipt.supplier_reference || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{receipt.warehouse_location || "MAIN"}</Badge>
                    </TableCell>
                    <TableCell>
                      {receipt.user_profiles?.full_name || "Unknown"}
                    </TableCell>
                    <TableCell>
                      {receipt.autocount_synced ? (
                        <div className="flex items-center gap-1 text-success">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-xs">
                            {receipt.autocount_doc_no || "Synced"}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span className="text-xs">Pending</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
