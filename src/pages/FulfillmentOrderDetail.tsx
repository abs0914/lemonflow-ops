import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, XCircle, Printer, RefreshCw, Truck } from "lucide-react";
import { useSalesOrder, useSalesOrderLines, useUpdateSalesOrder } from "@/hooks/useSalesOrders";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FulfillmentOrderActions } from "@/components/fulfillment/FulfillmentOrderActions";
import { DeliveryOrderDocument } from "@/components/fulfillment/DeliveryOrderDocument";
import { OrderLineForm } from "@/components/store-orders/OrderLineForm";
import { EditOrderLinesPanel } from "@/components/fulfillment/EditOrderLinesPanel";
import { OrderChangeHistory } from "@/components/fulfillment/OrderChangeHistory";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  submitted: "bg-blue-100 text-blue-800",
  pending_payment: "bg-orange-100 text-orange-800",
  pending_accounting: "bg-purple-100 text-purple-800",
  processing: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  issues: "bg-orange-100 text-orange-800",
};

export default function FulfillmentOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDeliveryOrder, setShowDeliveryOrder] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState("");

  const { data: order, isLoading, refetch } = useSalesOrder(id);
  const { data: lines } = useSalesOrderLines(id);
  const updateMutation = useUpdateSalesOrder();

  const isFranchisee = order?.stores?.store_type === "franchisee";

  const handleApproveOrder = async (deliveryDate: Date, deliveryFee: number) => {
    if (!order || !user) return;

    // Franchisee orders should not be approved by fulfillment - they go through Finance
    if (isFranchisee) {
      toast.error("Franchisee orders require payment confirmation from Finance first");
      return;
    }

    try {
      setIsSyncing(true);

      // For own stores, proceed with AutoCount sync directly
      const { data, error } = await supabase.functions.invoke("sync-sales-order", {
        body: { salesOrderId: order.id },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Sync failed");
      }

      await updateMutation.mutateAsync({
        id: order.id,
        updates: {
          status: "processing",
          delivery_date: deliveryDate.toISOString(),
          delivery_fee: deliveryFee,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          autocount_synced: true,
          autocount_doc_no: data?.documentNo || order.autocount_doc_no,
          synced_at: new Date().toISOString(),
        },
      });

      toast.success("Order approved and synced to AutoCount");
      refetch();
    } catch (error: any) {
      toast.error(`Failed to approve: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRejectOrder = async (reason: string) => {
    if (!order) return;

    try {
      // Release reserved stock if any
      if (order.stock_reserved) {
        await supabase.rpc("release_sales_order_stock", {
          p_sales_order_id: order.id,
        });
      }

      await updateMutation.mutateAsync({
        id: order.id,
        updates: {
          status: "cancelled",
          cancellation_reason: reason,
        },
      });

      toast.success("Order rejected");
      refetch();
    } catch (error: any) {
      toast.error(`Failed to reject: ${error.message}`);
    }
  };

  const handleCompleteOrder = async () => {
    if (!order || !user) return;

    try {
      // Complete stock (deduct actual stock, release reservation)
      const { error: stockError } = await supabase.rpc("complete_sales_order_stock", {
        p_sales_order_id: order.id,
      });
      if (stockError) {
        throw new Error(`Stock deduction failed: ${stockError.message}`);
      }

      await updateMutation.mutateAsync({
        id: order.id,
        updates: {
          status: "completed",
          fulfilled_by: user.id,
          fulfilled_at: new Date().toISOString(),
          delivery_notes: deliveryNotes || undefined,
        },
      });

      toast.success("Order marked as completed");
      refetch();
    } catch (error: any) {
      toast.error(`Failed to complete: ${error.message}`);
    }
  };

  const handleMarkWithIssues = async (notes: string) => {
    if (!order || !user) return;

    try {
      await updateMutation.mutateAsync({
        id: order.id,
        updates: {
          status: "issues",
          delivery_notes: [deliveryNotes, notes].filter(Boolean).join("\n---\nIssues: "),
          fulfilled_by: user.id,
          fulfilled_at: new Date().toISOString(),
        } as any,
      });

      toast.success("Order marked with issues");
      refetch();
    } catch (error: any) {
      toast.error(`Failed to mark issues: ${error.message}`);
    }
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

  const isSubmitted = order.status === "submitted";
  const isProcessing = order.status === "processing";
  const isPendingPayment = order.status === "pending_payment";
  const hasIssues = order.status === "issues";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/fulfillment")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{order.order_number}</h1>
              <p className="text-muted-foreground">{order.stores?.store_name}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDeliveryOrder(true)}>
              <Printer className="mr-2 h-4 w-4" />
              Print Delivery Order
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
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
                      ₱{((order.total_amount || 0) + (order.delivery_fee || 0) + (order.shipping_fee || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {order.description && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Franchisee Note</div>
                    <div className="text-sm bg-muted/50 rounded-md p-2 whitespace-pre-wrap">{order.description}</div>
                  </div>
                )}

                {order.autocount_synced && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">AutoCount Status</div>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      Synced - {order.autocount_doc_no}
                    </Badge>
                  </div>
                )}

                {order.cancellation_reason && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Cancellation Reason</div>
                    <div className="text-sm text-destructive">{order.cancellation_reason}</div>
                  </div>
                )}

                {hasIssues && order.delivery_notes && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Issue Notes</div>
                    <div className="text-sm text-orange-700 whitespace-pre-wrap">{order.delivery_notes}</div>
                  </div>
                )}

                {order.approved_at && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Approved At</div>
                    <div className="text-sm">{format(new Date(order.approved_at), "MMM dd, yyyy HH:mm")}</div>
                  </div>
                )}

                {order.fulfilled_at && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Fulfilled At</div>
                    <div className="text-sm">{format(new Date(order.fulfilled_at), "MMM dd, yyyy HH:mm")}</div>
                  </div>
                )}

                {order.stock_reserved && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Stock Status</div>
                    <Badge variant="outline" className="bg-accent text-accent-foreground border-border">
                      Stock Reserved
                    </Badge>
                  </div>
                )}

                {isPendingPayment && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Payment Status</div>
                    <Badge className="bg-accent text-accent-foreground">
                      Awaiting Payment Confirmation
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      Finance team needs to confirm payment before fulfillment can proceed.
                    </p>
                  </div>
                )}

                {order.payment_confirmed_at && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Payment Confirmed</div>
                    <div className="text-sm">
                      {format(new Date(order.payment_confirmed_at), "MMM dd, yyyy HH:mm")}
                      {order.payment_reference && (
                        <span className="text-muted-foreground ml-2">
                          (Ref: {order.payment_reference})
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                {(profile?.role === "Fulfillment" || profile?.role === "Admin") &&
                (order.status === "submitted" || order.status === "processing") ? (
                  <EditOrderLinesPanel orderId={order.id} lines={lines || []} />
                ) : (
                  <OrderLineForm lines={lines || []} onRemoveLine={() => {}} readOnly />
                )}
              </CardContent>
            </Card>

            <OrderChangeHistory orderId={order.id} />
          </div>

          <div className="space-y-6">
            <FulfillmentOrderActions
              order={order}
              onApprove={handleApproveOrder}
              onReject={handleRejectOrder}
              onComplete={handleCompleteOrder}
              onMarkWithIssues={handleMarkWithIssues}
              isLoading={updateMutation.isPending || isSyncing}
            />

            {isProcessing && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Delivery Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Add notes for delivery..."
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    rows={4}
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Store Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Store Code: </span>
                  <span className="font-medium">{order.stores?.store_code}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Debtor Code: </span>
                  <span className="font-medium">{order.debtor_code}</span>
                </div>
                {order.stores?.address && (
                  <div>
                    <span className="text-muted-foreground">Address: </span>
                    <span>{order.stores.address}</span>
                  </div>
                )}
                {order.stores?.contact_person && (
                  <div>
                    <span className="text-muted-foreground">Contact: </span>
                    <span>{order.stores.contact_person}</span>
                  </div>
                )}
                {order.stores?.phone && (
                  <div>
                    <span className="text-muted-foreground">Phone: </span>
                    <span>{order.stores.phone}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showDeliveryOrder && order && (
        <DeliveryOrderDocument
          order={order}
          lines={lines || []}
          open={showDeliveryOrder}
          onOpenChange={setShowDeliveryOrder}
        />
      )}
    </DashboardLayout>
  );
}
