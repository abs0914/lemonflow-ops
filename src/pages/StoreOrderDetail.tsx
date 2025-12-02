import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Trash2, Send, RefreshCw } from "lucide-react";
import { useSalesOrder, useSalesOrderLines, useUpdateSalesOrder, useDeleteSalesOrder } from "@/hooks/useSalesOrders";
import { DeleteOrderDialog } from "@/components/store-orders/DeleteOrderDialog";
import { OrderLineForm } from "@/components/store-orders/OrderLineForm";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const statusColors = {
  draft: "bg-gray-100 text-gray-800",
  submitted: "bg-blue-100 text-blue-800",
  processing: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function StoreOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: order, isLoading } = useSalesOrder(id);
  const { data: lines } = useSalesOrderLines(id);
  const updateMutation = useUpdateSalesOrder();
  const deleteMutation = useDeleteSalesOrder();

  const handleSubmitOrder = async () => {
    if (!order) return;

    await updateMutation.mutateAsync({
      id: order.id,
      updates: {
        status: "submitted",
        submitted_at: new Date().toISOString(),
      },
    });
  };

  const handleSyncToAutoCount = async () => {
    if (!order) return;

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-sales-order", {
        body: { salesOrderId: order.id },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Order synced successfully! Doc: ${data.documentNo}`);
        await updateMutation.mutateAsync({
          id: order.id,
          updates: {
            autocount_synced: true,
            autocount_doc_no: data.documentNo,
            synced_at: new Date().toISOString(),
            status: "processing",
          },
        });
      } else {
        throw new Error(data?.error || "Sync failed");
      }
    } catch (error: any) {
      toast.error(`Sync failed: ${error.message}`);
      await updateMutation.mutateAsync({
        id: order.id,
        updates: {
          sync_error_message: error.message,
        },
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!order) return;
    await deleteMutation.mutateAsync(order.id);
    navigate("/store/orders");
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Order not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const isDraft = order.status === "draft";
  const isSubmitted = order.status === "submitted";
  const canSync = isSubmitted && !order.autocount_synced;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/store/orders")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{order.order_number}</h1>
              <p className="text-muted-foreground">{order.stores?.store_name}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {isDraft && (
              <>
                <Button
                  variant="outline"
                  onClick={handleSubmitOrder}
                  disabled={updateMutation.isPending}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Submit Order
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleteMutation.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </>
            )}
            {canSync && (
              <Button
                onClick={handleSyncToAutoCount}
                disabled={isSyncing || updateMutation.isPending}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                Sync to AutoCount
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge className={statusColors[order.status]}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Order Date</div>
                  <div className="font-medium">{format(new Date(order.doc_date), "MMM dd, yyyy")}</div>
                </div>
                {order.delivery_date && (
                  <div>
                    <div className="text-sm text-muted-foreground">Delivery Date</div>
                    <div className="font-medium">{format(new Date(order.delivery_date), "MMM dd, yyyy")}</div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-muted-foreground">Total Amount</div>
                  <div className="font-bold text-lg">
                    ₱{order.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {order.description && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Description</div>
                  <div className="text-sm">{order.description}</div>
                </div>
              )}

              {order.autocount_synced && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">AutoCount Status</div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Synced - {order.autocount_doc_no}
                  </Badge>
                </div>
              )}

              {order.sync_error_message && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Sync Error</div>
                  <div className="text-sm text-destructive">{order.sync_error_message}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderLineForm lines={lines || []} onRemoveLine={() => {}} readOnly />
            </CardContent>
          </Card>
        </div>
      </div>

      <DeleteOrderDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteOrder}
        orderNumber={order.order_number}
      />
    </DashboardLayout>
  );
}
