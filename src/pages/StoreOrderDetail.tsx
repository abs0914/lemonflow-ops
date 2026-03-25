import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Trash2, Send, RefreshCw, Upload, Image, Printer, Download } from "lucide-react";
import { SalesOrderPrintView } from "@/components/store-orders/SalesOrderPrintView";
import { useSalesOrder, useSalesOrderLines, useUpdateSalesOrder, useDeleteSalesOrder } from "@/hooks/useSalesOrders";
import { DeleteOrderDialog } from "@/components/store-orders/DeleteOrderDialog";
import { OrderLineForm } from "@/components/store-orders/OrderLineForm";
import { Skeleton } from "@/components/ui/skeleton";
import { ProofImage } from "@/components/store-orders/ProofImage";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/10 text-primary",
  pending_payment: "bg-orange-100 text-orange-800",
  awaiting_proof: "bg-amber-100 text-amber-800",
  pending_accounting: "bg-purple-100 text-purple-800",
  processing: "bg-accent text-accent-foreground",
  completed: "bg-primary/20 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
  issues: "bg-orange-100 text-orange-800",
};

export default function StoreOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Extract clean error message, stripping HTML if present
      let errorMessage = error.message || "Unknown sync error";
      if (errorMessage.includes("<!DOCTYPE") || errorMessage.includes("<html")) {
        // Extract HTTP status if present, otherwise show generic message
        const statusMatch = errorMessage.match(/(\d{3})\s*-?\s*<!DOCTYPE/);
        errorMessage = statusMatch 
          ? `AutoCount API error (HTTP ${statusMatch[1]}): The sales order endpoint may not be configured on the backend.`
          : "AutoCount API error: Received invalid response from server. Please contact support.";
      }
      toast.error(`Sync failed: ${errorMessage}`);
      await updateMutation.mutateAsync({
        id: order.id,
        updates: {
          sync_error_message: errorMessage,
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
  const isAwaitingProof = order.status === "awaiting_proof";
  const canSync = isSubmitted && !order.autocount_synced;
  const canDeleteRoles = ["Admin", "Warehouse", "Fulfillment"];
  const canDelete = isDraft || (isSubmitted && profile?.role && canDeleteRoles.includes(profile.role));

  const handleUploadProof = async (file: File) => {
    if (!order) return;
    setIsUploadingProof(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${order.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Update order with proof URL and move to pending_accounting
      await updateMutation.mutateAsync({
        id: order.id,
        updates: {
          proof_of_payment_url: filePath,
        } as any,
      });

      toast.success("Proof of payment uploaded successfully!");
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploadingProof(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/store/orders")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{order.order_number}</h1>
              <p className="text-muted-foreground">{order.stores?.store_name}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isDraft && (
              <Button
                variant="outline"
                onClick={handleSubmitOrder}
                disabled={updateMutation.isPending}
              >
                <Send className="mr-2 h-4 w-4" />
                Submit Order
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleteMutation.isPending}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
            {canSync && profile?.role === "Admin" && (
              <Button
                onClick={handleSyncToAutoCount}
                disabled={isSyncing || updateMutation.isPending}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                Sync to AutoCount
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowPrintView(true)}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button variant="outline" onClick={() => setShowPrintView(true)}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
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
                  <Badge className={statusColors[order.status] || statusColors.draft}>
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
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
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

              {order.status === "cancelled" && order.cancellation_reason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <div className="text-sm font-medium text-destructive mb-1">Rejection Reason</div>
                  <div className="text-sm text-destructive/90">{order.cancellation_reason}</div>
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

          {/* Proof of Payment Upload - shown when awaiting_proof */}
          {isAwaitingProof && (
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Proof of Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Order Total</span>
                    <span>₱{(order.total_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {(order.delivery_fee || 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      <span>₱{(order.delivery_fee || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {(order.shipping_fee || 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping Fee</span>
                      <span>₱{(order.shipping_fee || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>Grand Total to Pay</span>
                    <span className="text-lg">
                      ₱{((order.total_amount || 0) + (order.delivery_fee || 0) + (order.shipping_fee || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Please upload a screenshot of your payment receipt or bank transfer confirmation.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadProof(file);
                  }}
                />

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingProof}
                  className="w-full"
                >
                  <Upload className={`mr-2 h-4 w-4 ${isUploadingProof ? "animate-spin" : ""}`} />
                  {isUploadingProof ? "Uploading..." : "Select & Upload Proof of Payment"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Show uploaded proof if exists */}
          {order.proof_of_payment_url && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  Proof of Payment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProofImage filePath={order.proof_of_payment_url} />
              </CardContent>
            </Card>
          )}
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
