import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesOrder, useSalesOrderLines } from "@/hooks/useSalesOrders";
import { useAccountingApprove, useAccountingNotePayment } from "@/hooks/useAccountingOrders";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";
import { ArrowLeft, Check, FileText, Package, Store, DollarSign, Image } from "lucide-react";
import { ProofImage } from "@/components/store-orders/ProofImage";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AccountingOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading: orderLoading } = useSalesOrder(id);
  const { data: lines, isLoading: linesLoading } = useSalesOrderLines(id);
  const accountingApprove = useAccountingApprove();
  const accountingNote = useAccountingNotePayment();

  const [notes, setNotes] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);

  const isLoading = orderLoading || linesLoading;

  const handleApprove = async () => {
    if (!id) return;

    try {
      await accountingApprove.mutateAsync({
        orderId: id,
        notes: notes || undefined,
      });
      toast.success("Order approved and sent to fulfillment");
      navigate("/accounting");
    } catch (error) {
      toast.error("Failed to approve order");
    }
  };

  const handleAddNote = async () => {
    if (!id || !notes.trim()) {
      toast.error("Please enter a note");
      return;
    }

    try {
      await accountingNote.mutateAsync({
        orderId: id,
        notes: notes,
      });
      toast.success("Note saved successfully");
    } catch (error) {
      toast.error("Failed to save note");
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-muted-foreground">
          Order not found
        </div>
      </DashboardLayout>
    );
  }

  const grandTotal = (order.total_amount || 0) + (order.delivery_fee || 0) + (order.shipping_fee || 0) + (order.expedite_fee || 0)
    + ((order as any).vat_amount || 0) - ((order as any).ewt_amount || 0) - ((order as any).discount_amount || 0)
    + ((order as any).underpayment || 0) - ((order as any).overpayment || 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/accounting")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {order.order_number}
            </h1>
            <p className="text-muted-foreground">Accounting Review</p>
          </div>
          <Badge className="ml-auto bg-purple-100 text-purple-800">
            Pending Accounting
          </Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Order Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Store</span>
                <span className="font-medium">{order.stores?.store_name || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Store Type</span>
                <Badge variant="outline" className="capitalize">
                  {order.stores?.store_type?.replace("_", " ") || "-"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Date</span>
                <span>{format(new Date(order.doc_date), "MMM d, yyyy")}</span>
              </div>
              {order.delivery_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery/Pickup Date</span>
                  <span>{format(new Date(order.delivery_date), "MMM d, yyyy")}</span>
                </div>
              )}
              {order.description && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Franchisee Note</span>
                  <span className="text-right max-w-[200px]">{order.description}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order Total</span>
                <span className="font-medium">{formatCurrency(order.total_amount || 0)}</span>
              </div>
              {(order.delivery_fee || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span>{formatCurrency(order.delivery_fee || 0)}</span>
                </div>
              )}
              {(order.shipping_fee || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping Fee</span>
                  <span>{formatCurrency(order.shipping_fee || 0)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Grand Total</span>
                <span className="font-bold text-lg">{formatCurrency(grandTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Amount</span>
                <span className="font-medium">{formatCurrency(order.payment_amount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Reference</span>
                <span>{order.payment_reference || "-"}</span>
              </div>
              {order.payment_confirmed_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Confirmed At</span>
                  <span>{format(new Date(order.payment_confirmed_at), "MMM d, yyyy HH:mm")}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Lines */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines?.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.line_number}</TableCell>
                    <TableCell className="font-mono">{line.item_code}</TableCell>
                    <TableCell>{line.item_name}</TableCell>
                    <TableCell className="text-right">{line.quantity}</TableCell>
                    <TableCell>{line.uom || "UNIT"}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(line.unit_price || 0)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(line.sub_total || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Proof of Payment */}
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

        {/* Accounting Actions */}
        {order.status === "pending_accounting" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Accounting Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accountingNotes">Accounting Notes</Label>
                <Textarea
                  id="accountingNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add accounting notes, payment verification details..."
                  rows={3}
                />
              </div>

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={handleAddNote}
                  disabled={accountingNote.isPending || !notes.trim()}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {accountingNote.isPending ? "Saving..." : "Save Note"}
                </Button>
                <Button
                  onClick={() => setShowApproveDialog(true)}
                  disabled={accountingApprove.isPending}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Approve & Send to Fulfillment
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approve Confirmation Dialog */}
        <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Approve Order for Fulfillment</AlertDialogTitle>
              <AlertDialogDescription>
                This will move order {order.order_number} to the Fulfillment module for processing. 
                Are you sure you want to proceed?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleApprove}>
                Approve
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
