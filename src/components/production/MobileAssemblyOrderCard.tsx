import { AssemblyOrder } from "@/hooks/useAssemblyOrders";
import { MobileDataCard, MobileDataRow } from "@/components/ui/mobile-data-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreVertical, Package } from "lucide-react";
import { format } from "date-fns";

interface MobileAssemblyOrderCardProps {
  order: AssemblyOrder;
  onOpenActions: (order: AssemblyOrder) => void;
}

export function MobileAssemblyOrderCard({ order, onOpenActions }: MobileAssemblyOrderCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500 hover:bg-blue-600">In Progress</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const actions = (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => onOpenActions(order)}
    >
      <MoreVertical className="h-4 w-4" />
    </Button>
  );

  const expandableContent = (
    <div className="space-y-2 pt-2 border-t">
      <MobileDataRow label="SKU" value={order.products?.sku || "-"} />
      <MobileDataRow label="Created By" value={order.user_profiles?.full_name || "-"} />
      <MobileDataRow 
        label="Due Date" 
        value={order.due_date ? format(new Date(order.due_date), "MMM dd, yyyy") : "Not set"} 
      />
      <MobileDataRow 
        label="Created" 
        value={format(new Date(order.created_at), "MMM dd, yyyy HH:mm")} 
      />
      {order.notes && (
        <MobileDataRow label="Notes" value={order.notes} />
      )}
    </div>
  );

  return (
    <MobileDataCard
      actions={actions}
      expandableContent={expandableContent}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm text-muted-foreground">
                Assembly Order
              </span>
            </div>
            <h3 className="font-semibold mt-1">{order.products?.name}</h3>
          </div>
          {getStatusBadge(order.status)}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Quantity</p>
            <p className="text-lg font-bold">{order.quantity}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="text-sm font-medium capitalize">{order.status.replace('_', ' ')}</p>
          </div>
        </div>
      </div>
    </MobileDataCard>
  );
}