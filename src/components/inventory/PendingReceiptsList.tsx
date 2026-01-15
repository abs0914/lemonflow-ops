import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Clock, 
  Package, 
  Search,
  ChevronRight,
  Building2,
  Calendar
} from "lucide-react";

interface PendingReceiptsListProps {
  onReceive?: (poId: string) => void;
}

interface PendingPO {
  id: string;
  po_number: string;
  doc_date: string;
  delivery_date: string | null;
  total_amount: number;
  is_cash_purchase: boolean | null;
  suppliers: {
    company_name: string;
    supplier_code: string;
  };
  line_count: number;
  received_count: number;
}

export function PendingReceiptsList({ onReceive }: PendingReceiptsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  // Fetch pending purchase orders with line counts
  const { data: pendingPOs, isLoading } = useQuery({
    queryKey: ["pending-receipts", searchTerm, filterType],
    queryFn: async () => {
      // First get approved POs
      let query = supabase
        .from("purchase_orders")
        .select(`
          id,
          po_number,
          doc_date,
          delivery_date,
          total_amount,
          is_cash_purchase,
          suppliers(company_name, supplier_code)
        `)
        .eq("status", "approved")
        .or("goods_received.is.null,goods_received.eq.false")
        .order("doc_date", { ascending: false });

      if (searchTerm) {
        query = query.or(`po_number.ilike.%${searchTerm}%,suppliers.company_name.ilike.%${searchTerm}%`);
      }

      if (filterType === "cash") {
        query = query.eq("is_cash_purchase", true);
      } else if (filterType === "credit") {
        query = query.or("is_cash_purchase.is.null,is_cash_purchase.eq.false");
      }

      const { data: pos, error } = await query;
      if (error) throw error;

      // Get line counts and received counts for each PO
      const posWithCounts = await Promise.all(
        (pos || []).map(async (po) => {
          // Get total lines
          const { count: lineCount } = await supabase
            .from("purchase_order_lines")
            .select("*", { count: "exact", head: true })
            .eq("purchase_order_id", po.id);

          // Get received lines (stock movements with this PO)
          const { count: receivedCount } = await supabase
            .from("stock_movements")
            .select("*", { count: "exact", head: true })
            .eq("purchase_order_id", po.id)
            .eq("movement_type", "receipt");

          return {
            ...po,
            line_count: lineCount || 0,
            received_count: receivedCount || 0,
          };
        })
      );

      return posWithCounts as PendingPO[];
    },
  });

  const getStatusBadge = (po: PendingPO) => {
    if (po.received_count === 0) {
      return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>;
    } else if (po.received_count < po.line_count) {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Partial</Badge>;
    } else {
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Complete</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2">Loading pending receipts...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Pending Receipts
        </CardTitle>
        <CardDescription>
          Approved purchase orders awaiting goods receipt
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search PO number or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="credit">Credit Purchase</SelectItem>
              <SelectItem value="cash">Cash Purchase</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingPOs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No pending receipts found
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingPOs?.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">{po.po_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {po.suppliers?.company_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(po.doc_date), "dd MMM yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>
                        {po.is_cash_purchase ? (
                          <Badge variant="secondary">Cash</Badge>
                        ) : (
                          <Badge variant="outline">Credit</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all"
                              style={{ 
                                width: `${po.line_count > 0 ? (po.received_count / po.line_count) * 100 : 0}%` 
                              }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {po.received_count}/{po.line_count}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(po)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onReceive?.(po.id)}
                          className="gap-1"
                        >
                          Receive
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {pendingPOs?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending receipts found
            </div>
          ) : (
            pendingPOs?.map((po) => (
              <Card key={po.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => onReceive?.(po.id)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold">{po.po_number}</div>
                      <div className="text-sm text-muted-foreground">{po.suppliers?.company_name}</div>
                    </div>
                    {getStatusBadge(po)}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {format(new Date(po.doc_date), "dd MMM yyyy")}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {po.received_count}/{po.line_count} items
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
