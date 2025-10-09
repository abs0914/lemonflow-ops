import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Package, RefreshCw } from "lucide-react";
import { MobileReceiptCard } from "./MobileReceiptCard";
import { useIsMobile } from "@/hooks/use-mobile";

interface StockReceipt {
  id: string;
  movement_type: string;
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
  const isMobile = useIsMobile();
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
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !receipts || receipts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No stock receipts recorded yet</p>
          </div>
        ) : isMobile ? (
          <div className="space-y-3">
            {receipts.map((receipt) => (
              <MobileReceiptCard key={receipt.id} receipt={receipt} />
            ))}
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Synced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell className="font-medium">{receipt.components?.name}</TableCell>
                    <TableCell>{receipt.components?.sku || "-"}</TableCell>
                    <TableCell className="text-right">{receipt.quantity}</TableCell>
                    <TableCell>{receipt.unit_received || "-"}</TableCell>
                    <TableCell>{receipt.batch_number || "-"}</TableCell>
                    <TableCell>{receipt.warehouse_location || "-"}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(receipt.created_at), { addSuffix: true })}
                      </span>
                    </TableCell>
                    <TableCell>
                      {receipt.autocount_synced ? (
                        <Badge variant="default" className="text-xs">Synced</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Pending</Badge>
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
