import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, FileText, Trash2, Edit, RefreshCw, Upload, Download, CheckCircle, Clock, Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobilePOCard } from "@/components/purchasing/MobilePOCard";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { Skeleton } from "@/components/ui/skeleton";
import { dateFormatters } from "@/lib/datetime";
import { formatCurrency } from "@/lib/currency";
import { DeletePurchaseOrderDialog } from "@/components/purchasing/DeletePurchaseOrderDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PurchaseOrder } from "@/types/inventory";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { useTableSort } from "@/hooks/useTableSort";

export default function Purchasing() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [financeFilter, setFinanceFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const isFinanceUser = profile?.role === "Finance";
  
  const { data: allOrders, isLoading } = usePurchaseOrders();
  
  const filteredOrders = useMemo(() => {
    return allOrders?.filter(order => {
      const matchesSearch = searchTerm === "" || 
        order.po_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
        order.suppliers?.company_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Finance users only see approved POs
      if (isFinanceUser) {
        if (order.status !== "approved") return false;
        
        // Apply finance-specific filter
        if (financeFilter === "pending_receipt") {
          return matchesSearch && !order.goods_received;
        } else if (financeFilter === "received") {
          return matchesSearch && order.goods_received;
        }
        return matchesSearch;
      }
      
      const matchesTab = activeTab === "all" || order.status === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [allOrders, searchTerm, activeTab, financeFilter, isFinanceUser]);

  const { sortKey, sortDirection, handleSort, sortedData } = useTableSort<PurchaseOrder>(filteredOrders);
  
  const getFinanceStats = () => {
    const approvedPOs = allOrders?.filter(o => o.status === "approved") || [];
    return {
      total: approvedPOs.length,
      pendingReceipt: approvedPOs.filter(o => !o.goods_received).length,
      received: approvedPOs.filter(o => o.goods_received).length,
      totalValue: approvedPOs.reduce((sum, o) => sum + (o.total_amount || 0), 0),
    };
  };
  
  const financeStats = isFinanceUser ? getFinanceStats() : null;
  
  const deleteMutation = useMutation({
    mutationFn: async (po: PurchaseOrder) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Delete lines first
      const { error: linesError } = await supabase
        .from("purchase_order_lines")
        .delete()
        .eq("purchase_order_id", po.id);
      if (linesError) throw linesError;

      // Delete PO
      const { error: poError } = await supabase
        .from("purchase_orders")
        .delete()
        .eq("id", po.id);
      if (poError) throw poError;

      // Log deletion to audit_logs
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "deleted",
        entity_type: "purchase_order",
        entity_id: po.id,
        details: { 
          po_number: po.po_number,
        },
      });
    },
    onSuccess: () => {
      toast.success("Purchase order deleted successfully");
      setDeleteDialogOpen(false);
      setPoToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const handleDeleteClick = (order: PurchaseOrder) => {
    setPoToDelete(order);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (poToDelete && (poToDelete.status === "draft" || poToDelete.status === "submitted")) {
      deleteMutation.mutate(poToDelete);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      submitted: "secondary",
      approved: "default",
      verified: "default",
      partially_received: "secondary",
      received: "default",
      cancelled: "destructive"
    };
    const labels: Record<string, string> = {
      partially_received: "Partial",
      received: "Received",
    };
    const label = labels[status] || status.charAt(0).toUpperCase() + status.slice(1);
    return <Badge variant={variants[status] || "outline"}>{label}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:items-center md:justify-between px-[20px] py-[23px] md:flex md:flex-row">
          <div>
            <h1 className="text-3xl font-bold">
              {isFinanceUser ? "Approved Purchase Orders" : "Purchase Orders"}
            </h1>
            <p className="text-muted-foreground">
              {isFinanceUser 
                ? "Review approved purchase orders and track goods receipt status" 
                : "Manage purchase orders and procurement"}
            </p>
          </div>
          {!isMobile && !isFinanceUser && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
                  toast.success("Refreshed purchase orders");
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button onClick={() => navigate("/purchasing/create")}>
                <Plus className="mr-2 h-4 w-4" />
                New Purchase Order
              </Button>
            </div>
          )}
          {!isMobile && isFinanceUser && (
            <Button
              variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
                toast.success("Refreshed purchase orders");
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          )}
        </div>

        {/* Finance Stats Cards */}
        {isFinanceUser && financeStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Approved</p>
                  <p className="text-2xl font-bold">{financeStats.total}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Receipt</p>
                  <p className="text-2xl font-bold">{financeStats.pendingReceipt}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Package className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Goods Received</p>
                  <p className="text-2xl font-bold">{financeStats.received}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(financeStats.totalValue)}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input placeholder="Search purchase orders..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-sm" />
              </div>
              {isFinanceUser ? (
                <Tabs value={financeFilter} onValueChange={setFinanceFilter} className="w-full md:w-auto">
                  <TabsList>
                    <TabsTrigger value="all">All Approved</TabsTrigger>
                    <TabsTrigger value="pending_receipt">Pending Receipt</TabsTrigger>
                    <TabsTrigger value="received">Goods Received</TabsTrigger>
                  </TabsList>
                </Tabs>
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="draft">Draft</TabsTrigger>
                    <TabsTrigger value="submitted">Submitted</TabsTrigger>
                    <TabsTrigger value="approved">Approved</TabsTrigger>
                    <TabsTrigger value="verified">Verified</TabsTrigger>
                    <TabsTrigger value="partially_received">Partial</TabsTrigger>
                    <TabsTrigger value="received">Received</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : isMobile ? (
              <div className="space-y-4">
                {sortedData?.map(order => <MobilePOCard key={order.id} order={order} onClick={() => navigate(`/purchasing/${order.id}`)} />)}
                {sortedData?.length === 0 && (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No purchase orders found</p>
                  </div>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead sortKey="po_number" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>PO Number</SortableTableHead>
                    <SortableTableHead sortKey="suppliers.company_name" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>Supplier</SortableTableHead>
                    <SortableTableHead sortKey="doc_date" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>Date</SortableTableHead>
                    <SortableTableHead sortKey="delivery_date" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>Delivery Date</SortableTableHead>
                    <SortableTableHead sortKey="total_amount" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>Total Amount</SortableTableHead>
                    {isFinanceUser ? (
                      <SortableTableHead sortKey="goods_received" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>Goods Receipt</SortableTableHead>
                    ) : (
                      <SortableTableHead sortKey="status" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>Status</SortableTableHead>
                    )}
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData?.map(order => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono">{order.po_number}</TableCell>
                      <TableCell className="font-medium">{order.suppliers?.company_name}</TableCell>
                      <TableCell>{dateFormatters.usShort(order.doc_date)}</TableCell>
                      <TableCell>{order.delivery_date ? dateFormatters.usShort(order.delivery_date) : "-"}</TableCell>
                      <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                      {isFinanceUser ? (
                        <TableCell>
                          {order.goods_received ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Received
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                      ) : (
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                      )}
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/purchasing/${order.id}`)}>
                            View
                          </Button>
                          {!isFinanceUser && (order.status === "draft" || order.status === "submitted") && (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => navigate(`/purchasing/${order.id}/edit`)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(order);
                                }}
                                className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedData?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No purchase orders found</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {isMobile && !isFinanceUser && <FloatingActionButton onClick={() => navigate("/purchasing/create")} icon={Plus} />}

        <DeletePurchaseOrderDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleConfirmDelete}
          poNumber={poToDelete?.po_number || ""}
          status={poToDelete?.status || ""}
          isDeleting={deleteMutation.isPending}
        />
      </div>
    </DashboardLayout>
  );
}
