import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { CheckCircle, XCircle, Truck, RefreshCw, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FulfillmentOrderActionsProps {
  order: {
    id: string;
    status: string;
    delivery_date?: string;
    autocount_synced?: boolean;
    stores?: {
      store_type?: string;
    };
  };
  onApprove: (deliveryDate: Date) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onComplete: () => Promise<void>;
  onMarkWithIssues: (notes: string) => Promise<void>;
  isLoading: boolean;
}

export function FulfillmentOrderActions({
  order,
  onApprove,
  onReject,
  onComplete,
  onMarkWithIssues,
  isLoading,
}: FulfillmentOrderActionsProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showIssuesDialog, setShowIssuesDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [issuesNotes, setIssuesNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(
    order.delivery_date ? new Date(order.delivery_date) : undefined
  );

  const isSubmitted = order.status === "submitted";
  const isProcessing = order.status === "processing";
  const isPendingPayment = order.status === "pending_payment";
  const isFranchisee = order.stores?.store_type === "franchisee";

  const handleRejectConfirm = async () => {
    await onReject(rejectReason);
    setShowRejectDialog(false);
    setRejectReason("");
  };

  const handleCompleteConfirm = async () => {
    await onComplete();
    setShowCompleteDialog(false);
  };

  const handleApproveConfirm = async () => {
    if (!deliveryDate) return;
    await onApprove(deliveryDate);
    setShowApproveDialog(false);
  };

  if (order.status === "completed" || order.status === "cancelled") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This order has been {order.status}.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isSubmitted && !isFranchisee && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Confirm Delivery Date <span className="text-destructive">*</span>
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !deliveryDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {deliveryDate ? format(deliveryDate, "PPP") : "Select delivery date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={deliveryDate}
                      onSelect={setDeliveryDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {!deliveryDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Set delivery date before approving
                  </p>
                )}
              </div>
              
              <Button
                className="w-full"
                onClick={() => setShowApproveDialog(true)}
                disabled={isLoading || !deliveryDate}
              >
                {isLoading ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Approve & Sync
              </Button>
              <Button
                variant="outline"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => setShowRejectDialog(true)}
                disabled={isLoading}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject Order
              </Button>
            </div>
          )}

          {isSubmitted && isFranchisee && (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">This franchisee order is awaiting payment confirmation.</p>
              <p className="text-xs mt-1">Finance will process payment first.</p>
            </div>
          )}

          {isPendingPayment && (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">Awaiting payment confirmation from Finance.</p>
              <p className="text-xs mt-1">Stock has been reserved for this order.</p>
            </div>
          )}

          {isProcessing && (
            <Button
              className="w-full"
              onClick={() => setShowCompleteDialog(true)}
              disabled={isLoading}
            >
              <Truck className="mr-2 h-4 w-4" />
              Mark as Completed
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Order</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirm}
              disabled={!rejectReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark this order as completed? This indicates the order has been delivered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompleteConfirm}>
              Complete Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Approval</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this order with delivery date{" "}
              <strong>{deliveryDate ? format(deliveryDate, "PPP") : ""}</strong>?
              This will sync the order to AutoCount.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApproveConfirm}>
              Approve Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
