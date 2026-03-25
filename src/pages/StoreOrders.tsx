import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, RefreshCw, ClipboardPaste } from "lucide-react";
import { useSalesOrders } from "@/hooks/useSalesOrders";
import { useAllUserStores } from "@/hooks/useUserStore";
import { MobileOrderCard } from "@/components/store-orders/MobileOrderCard";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { useTableSort } from "@/hooks/useTableSort";

const statusColors = {
  draft: "bg-gray-100 text-gray-800",
  submitted: "bg-blue-100 text-blue-800",
  pending_payment: "bg-orange-100 text-orange-800",
  awaiting_proof: "bg-amber-100 text-amber-800",
  pending_accounting: "bg-purple-100 text-purple-800",
  processing: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  issues: "bg-orange-100 text-orange-800",
};

export default function StoreOrders() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const { profile } = useAuth();
  const operationalRoles = ["Admin", "Warehouse", "Fulfillment", "Production", "Accounting"];
  const isOperational = operationalRoles.includes(profile?.role || "");

  const { data: userStores } = useAllUserStores();
  const storeIds = isOperational ? undefined : userStores?.map(s => s.store_id);
  const { data: orders, isLoading, refetch } = useSalesOrders(storeIds);

  const filteredOrders = useMemo(() => {
    return orders?.filter((order) => {
      const matchesSearch = searchTerm === "" ||
        order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.stores?.store_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTab = activeTab === "all" || order.status === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [orders, searchTerm, activeTab]);

  const { sortKey, sortDirection, handleSort, sortedData } = useTableSort(filteredOrders);

  const getStatusBadge = (status: string) => (
    <Badge className={statusColors[status as keyof typeof statusColors]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );

  const getSyncBadge = (synced: boolean, docNo?: string) => {
    if (synced) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          {docNo || "Synced"}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
        Pending
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Store Orders</h1>
            <p className="text-muted-foreground">
              Manage orders from your assigned stores
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size={isMobile ? "sm" : "default"}
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size={isMobile ? "sm" : "default"} onClick={() => navigate("/store/orders/quick-entry")}>
              <ClipboardPaste className="mr-2 h-4 w-4" />
              Quick Entry
            </Button>
            <Button size={isMobile ? "sm" : "default"} onClick={() => navigate("/store/orders/create")}>
              <Plus className="mr-2 h-4 w-4" />
              New Order
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order number or store..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="w-max md:w-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="submitted">Submitted</TabsTrigger>
              <TabsTrigger value="awaiting_proof">Awaiting Proof</TabsTrigger>
              <TabsTrigger value="processing">Processing</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : sortedData?.length === 0 ? (
              <div className="text-center py-12 border rounded-lg bg-muted/30">
                <p className="text-muted-foreground">No orders found</p>
              </div>
            ) : isMobile ? (
              <div className="space-y-4">
                {sortedData?.map((order) => (
                  <MobileOrderCard
                    key={order.id}
                    order={order}
                    onClick={() => navigate(`/store/orders/${order.id}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead sortKey="order_number" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>Order Number</SortableTableHead>
                      <SortableTableHead sortKey="stores.store_name" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>Store</SortableTableHead>
                      <SortableTableHead sortKey="doc_date" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>Date</SortableTableHead>
                      <SortableTableHead sortKey="status" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>Status</SortableTableHead>
                      <SortableTableHead sortKey="total_amount" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="text-right">Total</SortableTableHead>
                      <SortableTableHead sortKey="autocount_synced" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>AutoCount</SortableTableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedData?.map((order) => (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/store/orders/${order.id}`)}
                      >
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>{order.stores?.store_name}</TableCell>
                        <TableCell>{format(new Date(order.doc_date), "MMM dd, yyyy")}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell className="text-right">
                          ₱{order.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>{getSyncBadge(order.autocount_synced, order.autocount_doc_no)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
