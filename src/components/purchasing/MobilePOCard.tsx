import { Building2, Calendar, DollarSign, FileText } from "lucide-react";
import { MobileDataCard, MobileDataRow } from "@/components/ui/mobile-data-card";
import { Badge } from "@/components/ui/badge";
import { PurchaseOrder } from "@/types/inventory";
import { format } from "date-fns";

interface MobilePOCardProps {
  order: PurchaseOrder;
  onClick: () => void;
}

export function MobilePOCard({ order, onClick }: MobilePOCardProps) {
  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      submitted: "secondary",
      approved: "default",
      cancelled: "destructive"
    };
    return variants[status] || "outline";
  };

  return (
    <MobileDataCard
      expandableContent={
        order.remarks ? (
          <div className="text-sm text-muted-foreground">
            <strong>Remarks:</strong> {order.remarks}
          </div>
        ) : undefined
      }
      onClick={onClick}
    >
      <div className="space-y-2">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-base">PO {order.po_number}</h3>
            <p className="text-sm text-muted-foreground">{order.suppliers?.company_name || "—"}</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Badge variant={getStatusVariant(order.status)} className="text-xs">
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </Badge>
            <Badge variant={order.autocount_synced ? "default" : "outline"} className="text-xs">
              {order.autocount_synced ? "Synced" : "Not Synced"}
            </Badge>
          </div>
        </div>
        <MobileDataRow label="PO Number" value={order.po_number} />
        <MobileDataRow label="Date" value={format(new Date(order.doc_date), "dd/MM/yyyy")} />
        <MobileDataRow label="Amount" value={`$${order.total_amount.toFixed(2)}`} />
      </div>
    </MobileDataCard>
  );
}
