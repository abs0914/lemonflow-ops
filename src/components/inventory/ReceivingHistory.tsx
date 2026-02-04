import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  History, 
  Search,
  Package,
  CheckCircle,
  AlertCircle,
  Calendar
} from "lucide-react";

interface StockMovement {
  id: string;
  movement_type: string;
  item_type: string;
  item_id: string;
  quantity: number;
  unit_received: string | null;
  batch_number: string | null;
  warehouse_location: string | null;
  autocount_synced: boolean | null;
  autocount_doc_no: string | null;
  created_at: string;
  purchase_order_id: string | null;
  purchase_orders?: {
    po_number: string;
    suppliers?: {
      company_name: string;
    };
  } | null;
  // Joined item data
  item_name?: string;
  item_sku?: string;
}

export function ReceivingHistory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSync, setFilterSync] = useState<string>("all");

  // Fetch receiving history
  const { data: movements, isLoading } = useQuery({
    queryKey: ["receiving-history", searchTerm, filterType, filterSync],
    queryFn: async () => {
      let query = supabase
        .from("stock_movements")
        .select(`
          id,
          movement_type,
          item_type,
          item_id,
          quantity,
          unit_received,
          batch_number,
          warehouse_location,
          autocount_synced,
          autocount_doc_no,
          created_at,
          purchase_order_id,
          purchase_orders(po_number, suppliers(company_name))
        `)
        .eq("movement_type", "receipt")
        .order("created_at", { ascending: false })
        .limit(100);

      if (filterType !== "all") {
        query = query.eq("item_type", filterType);
      }

      if (filterSync === "synced") {
        query = query.eq("autocount_synced", true);
      } else if (filterSync === "pending") {
        query = query.or("autocount_synced.is.null,autocount_synced.eq.false");
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch item names for each movement
      const movementsWithItems = await Promise.all(
        (data || []).map(async (movement) => {
          let itemName = "Unknown";
          let itemSku = "";

          if (movement.item_type === "component") {
            const { data: component } = await supabase
              .from("components")
              .select("name, sku")
              .eq("id", movement.item_id)
              .single();
            if (component) {
              itemName = component.name;
              itemSku = component.sku;
            }
          } else if (movement.item_type === "raw_material") {
            const { data: rawMaterial } = await supabase
              .from("raw_materials")
              .select("name, sku")
              .eq("id", movement.item_id)
              .single();
            if (rawMaterial) {
              itemName = rawMaterial.name;
              itemSku = rawMaterial.sku;
            }
          }

          return {
            ...movement,
            item_name: itemName,
            item_sku: itemSku,
          };
        })
      );

      // Filter by search term
      if (searchTerm) {
        return movementsWithItems.filter(
          (m) =>
            m.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.item_sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.purchase_orders?.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.batch_number?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      return movementsWithItems as StockMovement[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <History className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2">Loading history...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Receiving History
        </CardTitle>
        <CardDescription>
          Recent goods received records with AutoCount sync status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search item, PO, or batch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Item type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="component">Inventory</SelectItem>
              <SelectItem value="raw_material">Raw Materials</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterSync} onValueChange={setFilterSync}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Sync status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="synced">Synced</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>PO</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Sync Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No receiving history found
                    </TableCell>
                  </TableRow>
                ) : (
                  movements?.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div>{format(new Date(movement.created_at), "dd MMM")}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(movement.created_at), "HH:mm")}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{movement.item_name}</div>
                          <div className="text-sm text-muted-foreground">{movement.item_sku}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={
                            movement.item_type === "raw_material"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }
                        >
                          {movement.item_type === "raw_material" ? "Raw" : "Inv"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {movement.purchase_orders ? (
                          <div>
                            <div className="font-medium">{movement.purchase_orders.po_number}</div>
                            <div className="text-xs text-muted-foreground">
                              {movement.purchase_orders.suppliers?.company_name}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Direct</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {movement.quantity} {movement.unit_received || ""}
                      </TableCell>
                      <TableCell>
                        {movement.batch_number || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {movement.warehouse_location || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {movement.autocount_synced ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Synced
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
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
          {movements?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No receiving history found
            </div>
          ) : (
            movements?.map((movement) => (
              <Card key={movement.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold">{movement.item_name}</div>
                      <div className="text-sm text-muted-foreground">{movement.item_sku}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge 
                        variant="outline" 
                        className={
                          movement.item_type === "raw_material"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }
                      >
                        {movement.item_type === "raw_material" ? "Raw" : "Inv"}
                      </Badge>
                      {movement.autocount_synced ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Synced
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Qty:</span>
                      <span className="ml-1 font-medium">{movement.quantity} {movement.unit_received}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date:</span>
                      <span className="ml-1">{format(new Date(movement.created_at), "dd MMM HH:mm")}</span>
                    </div>
                    {movement.purchase_orders && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">PO:</span>
                        <span className="ml-1">{movement.purchase_orders.po_number}</span>
                      </div>
                    )}
                    {movement.batch_number && (
                      <div>
                        <span className="text-muted-foreground">Batch:</span>
                        <span className="ml-1">{movement.batch_number}</span>
                      </div>
                    )}
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
