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
import { useConfirmPayment, useRejectPayment, useValidateProof } from "@/hooks/useFinanceOrders";
import { format } from "date-fns";
import { ArrowLeft, Check, X, Package, Store, DollarSign, Truck, ShoppingBag, ImageIcon, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

function ProofImage({ url }: { url: string }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useState(() => {
    // Generate signed URL for private bucket
    supabase.storage
      .from("payment-proofs")
      .createSignedUrl(url.replace(/^.*payment-proofs\//, ""), 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setImgUrl(data.signedUrl);
        else setImgUrl(url); // fallback to raw url
      });
  });

  if (!imgUrl) return <div className="p-8 text-center text-muted-foreground">Loading image...</div>;

  return (
    <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="block">
      <img
        src={imgUrl}
        alt="Proof of payment"
        className="w-full max-h-[500px] object-contain bg-muted"
      />
      <div className="flex items-center justify-center gap-1 py-2 text-sm text-muted-foreground hover:text-foreground">
        <ExternalLink className="h-3 w-3" />
        Open full size
      </div>
    </a>
  );
}

export default function FinanceOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading: orderLoading } = useSalesOrder(id);
  const { data: lines, isLoading: linesLoading } = useSalesOrderLines(id);
  const confirmPayment = useConfirmPayment();
  const rejectPayment = useRejectPayment();
  const validateProof = useValidateProof();
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState("");
  const [deliveryFee, setDeliveryFee] = useState<string>("0");
  const [shippingFee, setShippingFee] = useState<string>("0");
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("delivery");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const isLoading = orderLoading || linesLoading;

  // Initialize payment amount when order loads
  if (order && !paymentAmount) {
    setPaymentAmount((order.total_amount || 0).toString());
  }

  // Initialize payment amount when order loads
  if (order && !paymentAmount) {
    setPaymentAmount((order.total_amount || 0).toString());
  }

  const deliveryFeeAmount = parseFloat(deliveryFee) || 0;
  const shippingFeeAmount = parseFloat(shippingFee) || 0;
  const grandTotal = (order?.total_amount || 0) + deliveryFeeAmount + shippingFeeAmount;

  const handleConfirmPayment = async () => {
    if (!id) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    if (amount !== grandTotal) {
      toast.error(`Payment amount must equal the grand total of ₱${grandTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })} (order total + delivery fee)`);
      return;
    }

    try {
      await confirmPayment.mutateAsync({
        orderId: id,
        paymentAmount: amount,
        paymentReference: paymentReference || undefined,
        deliveryFee: deliveryFeeAmount,
        shippingFee: shippingFeeAmount,
      });
      
      toast.success("Fees set. Order sent to franchisee for proof of payment upload.");
      navigate("/finance");
    } catch (error) {
      toast.error("Failed to process order");
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
            <p className="text-muted-foreground">
              {order.status === 'awaiting_proof' ? 'Proof of Payment Review' : 'Payment Confirmation'}
            </p>
          </div>
          {order.status === 'awaiting_proof' ? (
            <Badge className={order.proof_of_payment_url ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800"}>
              {order.proof_of_payment_url ? "Proof Submitted" : "Awaiting Proof"}
            </Badge>
          ) : (
            <Badge className="bg-orange-100 text-orange-800">
              Pending Payment
            </Badge>
          )}
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

        {/* Proof of Payment Review (for awaiting_proof status) */}
        {order.status === 'awaiting_proof' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Proof of Payment Review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Fee Summary */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order Total</span>
                  <span>₱{(order.total_amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span>₱{(order.delivery_fee || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping Fee</span>
                  <span>₱{(order.shipping_fee || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Payment Amount</span>
                  <span className="text-lg">₱{(order.payment_amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                </div>
                {order.payment_reference && (
                  <div className="flex justify-between text-sm pt-1">
                    <span className="text-muted-foreground">Payment Reference</span>
                    <span>{order.payment_reference}</span>
                  </div>
                )}
              </div>

              {/* Proof Image */}
              {order.proof_of_payment_url ? (
                <div className="space-y-3">
                  <Label>Uploaded Proof of Payment</Label>
                  <div className="rounded-lg border overflow-hidden">
                    <ProofImage url={order.proof_of_payment_url} />
                  </div>
                  <div className="flex gap-4 pt-2">
                    <Button
                      onClick={async () => {
                        if (!id) return;
                        try {
                          await validateProof.mutateAsync({ orderId: id });
                          toast.success("Proof validated. Order sent to Accounting for final review.");
                          navigate("/finance");
                        } catch (error) {
                          toast.error("Failed to validate proof");
                        }
                      }}
                      disabled={validateProof.isPending}
                      className="flex-1"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      {validateProof.isPending ? "Processing..." : "Validate & Send to Accounting"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowRejectDialog(true)}
                      disabled={rejectPayment.isPending}
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Waiting for franchisee to upload proof of payment</p>
                  <p className="text-sm mt-1">The franchisee has been notified to upload their payment screenshot.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payment Confirmation Form (for pending_payment status) */}
        {order.status === 'pending_payment' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Set Fees & Send for Proof of Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deliveryFee">Delivery Fee (₱)</Label>
                <Input
                  id="deliveryFee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={deliveryFee}
                  onChange={(e) => {
                    setDeliveryFee(e.target.value);
                    const fee = parseFloat(e.target.value) || 0;
                    const shipping = parseFloat(shippingFee) || 0;
                    setPaymentAmount(((order.total_amount || 0) + fee + shipping).toString());
                  }}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shippingFee">Shipping Fee (₱)</Label>
                <Input
                  id="shippingFee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={shippingFee}
                  onChange={(e) => {
                    setShippingFee(e.target.value);
                    const shipping = parseFloat(e.target.value) || 0;
                    const delivery = parseFloat(deliveryFee) || 0;
                    setPaymentAmount(((order.total_amount || 0) + delivery + shipping).toString());
                  }}
                  placeholder="0.00"
                />
              </div>
            </div>
            {/* Grand Total Summary */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order Total</span>
                <span>₱{(order.total_amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span>₱{deliveryFeeAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipping Fee</span>
                <span>₱{shippingFeeAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-2">
                <span>Grand Total</span>
                <span className="text-lg">₱{grandTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

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
                  Must equal grand total of ₱{grandTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
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

            {/* Order Type Selection */}
            <div className="space-y-3">
              <Label>Order Fulfillment Type <span className="text-destructive">*</span></Label>
              <RadioGroup
                value={orderType}
                onValueChange={(val) => setOrderType(val as "delivery" | "pickup")}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2 rounded-lg border px-4 py-3 cursor-pointer flex-1 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                  <RadioGroupItem value="delivery" id="type-delivery" />
                  <label htmlFor="type-delivery" className="flex items-center gap-2 cursor-pointer font-medium">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    Delivery
                  </label>
                </div>
                <div className="flex items-center gap-2 rounded-lg border px-4 py-3 cursor-pointer flex-1 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                  <RadioGroupItem value="pickup" id="type-pickup" />
                  <label htmlFor="type-pickup" className="flex items-center gap-2 cursor-pointer font-medium">
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    Pickup
                  </label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                onClick={handleConfirmPayment}
                disabled={confirmPayment.isPending}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                {confirmPayment.isPending ? "Processing..." : "Set Fees & Send for Proof"}
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
        )}
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
