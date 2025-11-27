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
import { Badge } from "@/components/ui/badge";

interface DeletePurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  poNumber: string;
  status: string;
  isDeleting: boolean;
}

export function DeletePurchaseOrderDialog({
  open,
  onOpenChange,
  onConfirm,
  poNumber,
  status,
  isDeleting,
}: DeletePurchaseOrderDialogProps) {
  const canDelete = status === "draft" || status === "submitted";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {canDelete ? "Delete Purchase Order?" : "Cannot Delete Purchase Order"}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            {canDelete ? (
              <>
                <p>
                  Are you sure you want to delete purchase order <strong>{poNumber}</strong>?
                </p>
                <p className="text-sm">
                  This action cannot be undone. This will permanently delete the purchase order
                  and all its line items.
                </p>
              </>
            ) : (
              <>
                <p>
                  Purchase order <strong>{poNumber}</strong> cannot be deleted because it has status:{" "}
                  <Badge variant={status === "approved" ? "default" : "destructive"} className="ml-1">
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Badge>
                </p>
                <p className="text-sm text-muted-foreground">
                  Only purchase orders with status "Draft" or "Submitted" can be deleted.
                  {status === "approved" && " For approved orders, consider using the Cancel function instead."}
                </p>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            {canDelete ? "Cancel" : "Close"}
          </AlertDialogCancel>
          {canDelete && (
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
