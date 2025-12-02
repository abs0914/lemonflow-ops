import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Edit, Trash2, FileText, CheckCircle, X, Upload, PackageCheck } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePurchaseOrder, usePurchaseOrderLines } from "@/hooks/usePurchaseOrders";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { dateFormatters } from "@/lib/datetime";
import { formatCurrency } from "@/lib/currency";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceiveFromCashPO } from "@/components/warehouse/ReceiveFromCashPO";

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: purchaseOrder, isLoading: loadingPO } = usePurchaseOrder(id);
  const { data: lines, isLoading: loadingLines } = usePurchaseOrderLines(id);

  const { data: cashGivenByUser } = useQuery({
    queryKey: ["user-profile", purchaseOrder?.cash_given_by],
    queryFn: async () => {
      if (!purchaseOrder?.cash_given_by) return null;
      const { data } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", purchaseOrder.cash_given_by)
        .single();
      return data;
    },
    enabled: !!purchaseOrder?.cash_given_by,
  });

  const { data: cashReturnedToUser } = useQuery({
    queryKey: ["user-profile", purchaseOrder?.cash_returned_to],
    queryFn: async () => {
      if (!purchaseOrder?.cash_returned_to) return null;
      const { data } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", purchaseOrder.cash_returned_to)
        .single();
      return data;
    },
    enabled: !!purchaseOrder?.cash_returned_to,
  });

  const syncToAutocountMutation = useMutation({
    mutationFn: async () => {
      if (!purchaseOrder || !lines) throw new Error("PO data not loaded");
      
      // Cash Purchase POs with raw materials should not sync to AutoCount
      if (purchaseOrder.is_cash_purchase) {
        throw new Error("Cash Purchase POs cannot be synced to AutoCount. Raw materials are local-only.");
      }
      
      setIsSyncing(true);
      
      const { data, error } = await supabase.functions.invoke("sync-po-create", {
        body: {
          poNumber: purchaseOrder.po_number,
          supplierId: purchaseOrder.supplier_id,
          docDate: purchaseOrder.doc_date,
          deliveryDate: purchaseOrder.delivery_date,
          remarks: purchaseOrder.remarks,
          lines: lines.map((line) => {
            const item = line.item_type === 'raw_material' ? line.raw_materials : line.components;
            return {
              itemCode: item?.autocount_item_code || item?.sku || "",
              description: item?.name || "",
              quantity: line.quantity,
              unitPrice: line.unit_price,
              uom: line.uom,
              lineRemarks: line.line_remarks,
            };
          }),
        },
      });

      if (error) throw error;
      
      // Update PO with AutoCount doc number
      const { error: updateError } = await supabase
        .from("purchase_orders")
        .update({
          autocount_synced: true,
          autocount_doc_no: data.docNo,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      setIsSyncing(false);
      return data;
    },
    onSuccess: () => {
      toast.success("Successfully synced to AutoCount");
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (error) => {
      setIsSyncing(false);
      toast.error(`Failed to sync to AutoCount: ${error.message}`);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated successfully");
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  const cancelPOMutation = useMutation({
    mutationFn: async () => {
      // Update local status
      const { error: statusError } = await supabase
        .from("purchase_orders")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (statusError) throw statusError;

      // Sync to AutoCount if it was synced
      if (purchaseOrder?.autocount_synced) {
        setIsSyncing(true);
        
        const { error: syncError } = await supabase.functions.invoke("sync-po-cancel", {
          body: {
            poNumber: purchaseOrder.po_number,
            autocountDocNo: purchaseOrder.autocount_doc_no,
          },
        });

        setIsSyncing(false);

        if (syncError) {
          console.error("AutoCount cancel error:", syncError);
          toast.error("PO cancelled locally but failed to sync to AutoCount");
        }
      }
    },
    onSuccess: () => {
      toast.success("Purchase order cancelled");
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setShowCancelDialog(false);
    },
    onError: (error) => {
      toast.error(`Failed to cancel: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Delete lines first
      const { error: linesError } = await supabase
        .from("purchase_order_lines")
        .delete()
        .eq("purchase_order_id", id);
      if (linesError) throw linesError;

      // Delete PO
      const { error: poError } = await supabase
        .from("purchase_orders")
        .delete()
        .eq("id", id);
      if (poError) throw poError;
    },
    onSuccess: () => {
      toast.success("Purchase order deleted");
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      navigate("/purchasing");
    },
    onError: () => {
      toast.error("Failed to delete purchase order");
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      submitted: "secondary",
      approved: "default",
      cancelled: "destructive",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loadingPO || loadingLines) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!purchaseOrder) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <FileText className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-2xl font-semibold">Purchase Order Not Found</h2>
          <Button onClick={() => navigate("/purchasing")}>Back to Purchase Orders</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/purchasing")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Purchase Order {purchaseOrder.po_number}</h1>
              <p className="text-muted-foreground">
                Created by {purchaseOrder.user_profiles?.full_name} on{" "}
                {dateFormatters.short(purchaseOrder.created_at)}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {purchaseOrder.status === "draft" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/purchasing/${id}/edit`)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => updateStatusMutation.mutate("submitted")}
                  disabled={updateStatusMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Submit
                </Button>
                {!purchaseOrder.autocount_synced && !purchaseOrder.is_cash_purchase && (
                  <Button
                    variant="outline"
                    onClick={() => syncToAutocountMutation.mutate()}
                    disabled={isSyncing || syncToAutocountMutation.isPending}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isSyncing ? "Syncing..." : "Sync to AutoCount"}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </>
            )}
            {purchaseOrder.status === "submitted" && (
              <>
                <Button
                  onClick={() => updateStatusMutation.mutate("approved")}
                  disabled={updateStatusMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                {!purchaseOrder.autocount_synced && !purchaseOrder.is_cash_purchase && (
                  <Button
                    variant="outline"
                    onClick={() => syncToAutocountMutation.mutate()}
                    disabled={isSyncing || syncToAutocountMutation.isPending}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isSyncing ? "Syncing..." : "Sync to AutoCount"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(true)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel PO
                </Button>
              </>
            )}
            {purchaseOrder.status === "approved" && (
              <>
                {!purchaseOrder.autocount_synced && !purchaseOrder.is_cash_purchase && (
                  <Button
                    variant="outline"
                    onClick={() => syncToAutocountMutation.mutate()}
                    disabled={isSyncing || syncToAutocountMutation.isPending}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isSyncing ? "Syncing..." : "Sync to AutoCount"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(true)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel PO
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Purchase Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">PO Number</p>
                  <p className="font-medium font-mono">{purchaseOrder.po_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(purchaseOrder.status)}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">PO Date</p>
                  <p className="font-medium">{dateFormatters.short(purchaseOrder.doc_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Date</p>
                  <p className="font-medium">
                    {purchaseOrder.delivery_date
                      ? dateFormatters.short(purchaseOrder.delivery_date)
                      : "—"}
                  </p>
                </div>
              </div>
              {purchaseOrder.remarks && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Remarks</p>
                    <p className="text-sm">{purchaseOrder.remarks}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supplier Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Company Name</p>
                <p className="font-medium">{purchaseOrder.suppliers?.company_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Supplier Code</p>
                <p className="font-medium font-mono">{purchaseOrder.suppliers?.supplier_code}</p>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">AutoCount Status</p>
                  <Badge variant={purchaseOrder.autocount_synced ? "default" : "outline"} className="mt-1">
                    {purchaseOrder.autocount_synced ? "Synced" : "Not Synced"}
                  </Badge>
                </div>
                {purchaseOrder.autocount_doc_no && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Doc No</p>
                    <p className="font-medium font-mono">{purchaseOrder.autocount_doc_no}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {purchaseOrder.is_cash_purchase && (
          <Card>
            <CardHeader>
              <CardTitle>Cash Flow Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cash Advance</p>
                  <p className="text-2xl font-bold">{formatCurrency(purchaseOrder.cash_advance || 0)}</p>
                  {cashGivenByUser && (
                    <p className="text-xs text-muted-foreground mt-1">Given by: {cashGivenByUser.full_name}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-2xl font-bold">{formatCurrency(purchaseOrder.total_amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cash Returned</p>
                  <p className="text-2xl font-bold">{formatCurrency(purchaseOrder.cash_returned || 0)}</p>
                  {cashReturnedToUser && (
                    <p className="text-xs text-muted-foreground mt-1">To: {cashReturnedToUser.full_name}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className={`text-2xl font-bold ${
                    Math.abs((purchaseOrder.cash_advance || 0) - purchaseOrder.total_amount - (purchaseOrder.cash_returned || 0)) < 0.01
                      ? "text-green-600"
                      : "text-destructive"
                  }`}>
                    {Math.abs((purchaseOrder.cash_advance || 0) - purchaseOrder.total_amount - (purchaseOrder.cash_returned || 0)) < 0.01
                      ? "✓ Settled"
                      : `⚠ ${formatCurrency(Math.abs((purchaseOrder.cash_advance || 0) - purchaseOrder.total_amount - (purchaseOrder.cash_returned || 0)))}`}
                  </p>
                </div>
              </div>
              
              {purchaseOrder.is_cash_purchase && !purchaseOrder.goods_received && purchaseOrder.status === "approved" && (
                <div className="mt-4 pt-4 border-t">
                  <Button onClick={() => setShowReceiveDialog(true)}>
                    <PackageCheck className="h-4 w-4 mr-2" />
                    Receive Goods
                  </Button>
                </div>
              )}

              {purchaseOrder.goods_received && (
                <div className="mt-4 pt-4 border-t">
                  <Badge variant="default">
                    Goods Received on {purchaseOrder.received_at ? dateFormatters.short(purchaseOrder.received_at) : ""}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Component</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines?.map((line) => {
                  const item = line.item_type === 'raw_material' ? line.raw_materials : line.components;
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">{line.line_number}</TableCell>
                      <TableCell>{item?.name}</TableCell>
                      <TableCell className="font-mono text-sm">{item?.sku}</TableCell>
                      <TableCell className="text-right">{line.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(line.unit_price)}</TableCell>
                      <TableCell>{line.uom}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(line.quantity * line.unit_price)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Separator className="my-4" />
            <div className="flex justify-end">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-3xl font-bold">{formatCurrency(purchaseOrder.total_amount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this purchase order? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {purchaseOrder.is_cash_purchase && lines && (
          <ReceiveFromCashPO
            open={showReceiveDialog}
            onOpenChange={setShowReceiveDialog}
            purchaseOrderId={purchaseOrder.id}
            poNumber={purchaseOrder.po_number}
            lines={lines}
          />
        )}

        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Purchase Order</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel this purchase order? 
                {purchaseOrder.autocount_synced && " This will also cancel it in AutoCount."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => cancelPOMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={cancelPOMutation.isPending || isSyncing}
              >
                {cancelPOMutation.isPending || isSyncing ? "Cancelling..." : "Yes, Cancel PO"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
