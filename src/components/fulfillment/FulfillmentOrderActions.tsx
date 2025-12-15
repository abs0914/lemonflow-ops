import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
import { CheckCircle, XCircle, Truck, RefreshCw } from "lucide-react";

interface FulfillmentOrderActionsProps {
  order: {
    id: string;
    status: string;
    autocount_synced?: boolean;
    stores?: {
      store_type?: string;
    };
  };
  onApprove: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onComplete: () => Promise<void>;
  isLoading: boolean;
}

export function FulfillmentOrderActions({
  order,
  onApprove,
  onReject,
  onComplete,
  isLoading,
}: FulfillmentOrderActionsProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

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
          {isSubmitted && (
            <>
              <Button
                className="w-full"
                onClick={onApprove}
                disabled={isLoading}
              >
                {isLoading ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                {isFranchisee ? "Approve & Send for Payment" : "Approve & Sync"}
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
            </>
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
    </>
  );
}
