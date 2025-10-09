import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Edit, Trash2, FileText, CheckCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePurchaseOrder, usePurchaseOrderLines } from "@/hooks/usePurchaseOrders";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: purchaseOrder, isLoading: loadingPO } = usePurchaseOrder(id);
  const { data: lines, isLoading: loadingLines } = usePurchaseOrderLines(id);

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
                {format(new Date(purchaseOrder.created_at), "dd/MM/yyyy")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {purchaseOrder.status === "draft" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => updateStatusMutation.mutate("submitted")}
                  disabled={updateStatusMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Submit
                </Button>
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
              <Button
                onClick={() => updateStatusMutation.mutate("approved")}
                disabled={updateStatusMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
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
                  <p className="font-medium">{format(new Date(purchaseOrder.doc_date), "dd/MM/yyyy")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Date</p>
                  <p className="font-medium">
                    {purchaseOrder.delivery_date
                      ? format(new Date(purchaseOrder.delivery_date), "dd/MM/yyyy")
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
                {lines?.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-medium">{line.line_number}</TableCell>
                    <TableCell>{line.components?.name}</TableCell>
                    <TableCell className="font-mono text-sm">{line.components?.sku}</TableCell>
                    <TableCell className="text-right">{line.quantity}</TableCell>
                    <TableCell className="text-right">${line.unit_price.toFixed(2)}</TableCell>
                    <TableCell>{line.uom}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${(line.quantity * line.unit_price).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Separator className="my-4" />
            <div className="flex justify-end">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-3xl font-bold">${purchaseOrder.total_amount.toFixed(2)}</p>
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
      </div>
    </DashboardLayout>
  );
}
