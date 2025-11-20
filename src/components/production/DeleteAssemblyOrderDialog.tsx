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

interface DeleteAssemblyOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  orderCount: number;
  isDeleting?: boolean;
}

export function DeleteAssemblyOrderDialog({
  open,
  onOpenChange,
  onConfirm,
  orderCount,
  isDeleting = false,
}: DeleteAssemblyOrderDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Assembly {orderCount === 1 ? "Order" : "Orders"}?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete {orderCount === 1 ? "this assembly order" : `${orderCount} assembly orders`} and remove the data from the database.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
