import { AssemblyOrder } from "@/hooks/useAssemblyOrders";
import { ActionSheet, ActionSheetAction } from "@/components/ui/action-sheet";
import { CheckCircle2, XCircle, Eye, Edit } from "lucide-react";

interface OrderActionSheetProps {
  order: AssemblyOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (order: AssemblyOrder) => void;
  onCancel: (order: AssemblyOrder) => void;
}

export function OrderActionSheet({
  order,
  open,
  onOpenChange,
  onComplete,
  onCancel,
}: OrderActionSheetProps) {
  if (!order) return null;

  const isPending = order.status === "pending";

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Order Actions"
      description={`Actions for ${order.products?.name}`}
    >
      <div className="space-y-2">
        {isPending && (
          <>
            <ActionSheetAction
              label="Mark as Complete"
              onClick={() => onComplete(order)}
              icon={<CheckCircle2 className="h-5 w-5" />}
              variant="default"
            />
            <ActionSheetAction
              label="Cancel Order"
              onClick={() => onCancel(order)}
              icon={<XCircle className="h-5 w-5" />}
              variant="destructive"
            />
          </>
        )}
        <ActionSheetAction
          label="View Details"
          onClick={() => {/* View details logic */}}
          icon={<Eye className="h-5 w-5" />}
          variant="outline"
        />
      </div>
    </ActionSheet>
  );
}