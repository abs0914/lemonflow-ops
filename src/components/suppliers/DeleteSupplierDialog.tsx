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
import { AlertCircle } from "lucide-react";

interface DeleteSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  supplierName: string;
  relatedPOCount: number;
  isDeleting: boolean;
}

export function DeleteSupplierDialog({
  open,
  onOpenChange,
  onConfirm,
  supplierName,
  relatedPOCount,
  isDeleting,
}: DeleteSupplierDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Delete Supplier?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete <strong>{supplierName}</strong>?
            </p>
            {relatedPOCount > 0 ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mt-2">
                <p className="text-destructive font-medium">
                  Warning: This supplier has {relatedPOCount} related purchase order(s).
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Deleting this supplier will not affect existing purchase orders, 
                  but you won't be able to create new orders with this supplier.
                </p>
              </div>
            ) : (
              <p className="text-sm">
                This action cannot be undone. This will permanently delete the supplier 
                and all associated data.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete Supplier'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
