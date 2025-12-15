import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesOrder, useSalesOrderLines } from "@/hooks/useSalesOrders";
import { useConfirmPayment, useRejectPayment } from "@/hooks/useFinanceOrders";
import { format } from "date-fns";
import { ArrowLeft, Check, X, Package, Store, Calendar, DollarSign } from "lucide-react";
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

export default function FinanceOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading: orderLoading } = useSalesOrder(id);
  const { data: lines, isLoading: linesLoading } = useSalesOrderLines(id);
  const confirmPayment = useConfirmPayment();
  const rejectPayment = useRejectPayment();

  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const isLoading = orderLoading || linesLoading;

  // Initialize payment amount when order loads
  if (order && !paymentAmount) {
    setPaymentAmount((order.total_amount || 0).toString());
  }

  const handleConfirmPayment = async () => {
    if (!id) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    if (amount !== order?.total_amount) {
      toast.error("Payment amount must equal the order total (no partial payments)");
      return;
    }

    try {
      const result = await confirmPayment.mutateAsync({
        orderId: id,
        paymentAmount: amount,
        paymentReference: paymentReference || undefined,
      });
      
      if (result?.syncSuccess) {
        toast.success(`Payment confirmed and synced to AutoCount (${result.documentNo})`);
      } else {
        toast.success("Payment confirmed (AutoCount sync pending)");
      }
      navigate("/finance");
    } catch (error) {
      toast.error("Failed to confirm payment");
    }
  };

  const handleRejectPayment = async () => {
    if (!id || !rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    try {
      await rejectPayment.mutateAsync({
        orderId: id,
        reason: rejectReason,
      });
      toast.success("Payment rejected and stock released");
      navigate("/finance");
    } catch (error) {
      toast.error("Failed to reject payment");
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
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
          <Button variant="outline" className="mt-4" onClick={() => navigate("/finance")}>
            Back to Finance
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/finance")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{order.order_number}</h1>
            <p className="text-muted-foreground">Payment Confirmation</p>
          </div>
          <Badge className="bg-orange-100 text-orange-800">
            Pending Payment
          </Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Order Number</Label>
                  <p className="font-medium">{order.order_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Order Date</Label>
                  <p className="font-medium">
                    {format(new Date(order.doc_date), "MMM d, yyyy")}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Delivery Date</Label>
                  <p className="font-medium">
                    {order.delivery_date
                      ? format(new Date(order.delivery_date), "MMM d, yyyy")
                      : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Stock Reserved</Label>
                  <p className="font-medium">
                    {order.stock_reserved ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        Reserved
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not Reserved</Badge>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Store Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Store Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Store Name</Label>
                  <p className="font-medium">{order.stores?.store_name || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Store Type</Label>
                  <Badge variant="outline" className="capitalize">
                    {order.stores?.store_type?.replace("_", " ") || "-"}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Debtor Code</Label>
                  <p className="font-medium">{order.debtor_code}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Contact</Label>
                  <p className="font-medium">{order.stores?.contact_person || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
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
                    <TableCell>{line.uom}</TableCell>
                    <TableCell className="text-right">
                      ₱{(line.unit_price || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₱{(line.sub_total || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={6} className="text-right font-bold">
                    Total Amount
                  </TableCell>
                  <TableCell className="text-right font-bold text-lg">
                    ₱{(order.total_amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Payment Confirmation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payment Confirmation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Payment Amount (₱)</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter payment amount"
                />
                <p className="text-xs text-muted-foreground">
                  Must equal order total of ₱{(order.total_amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentReference">Payment Reference (Optional)</Label>
                <Input
                  id="paymentReference"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Bank transfer ref, receipt number, etc."
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                onClick={handleConfirmPayment}
                disabled={confirmPayment.isPending}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                {confirmPayment.isPending ? "Confirming..." : "Confirm Payment"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowRejectDialog(true)}
                disabled={rejectPayment.isPending}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Reject Payment
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Payment</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the order and release the reserved stock. Please provide a reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="rejectReason">Rejection Reason</Label>
            <Textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter the reason for rejecting this payment..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectPayment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
