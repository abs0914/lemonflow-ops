import { SalesOrder } from "@/types/sales-order";
import { MobileDataCard, MobileDataRow } from "@/components/ui/mobile-data-card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface MobileOrderCardProps {
  order: SalesOrder;
  onClick: () => void;
}

const statusColors = {
  draft: "bg-gray-100 text-gray-800",
  submitted: "bg-blue-100 text-blue-800",
  processing: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function MobileOrderCard({ order, onClick }: MobileOrderCardProps) {
  return (
    <MobileDataCard onClick={onClick}>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold text-foreground">{order.order_number}</div>
            <div className="text-sm text-muted-foreground">{order.stores?.store_name}</div>
          </div>
          <Badge className={statusColors[order.status]}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Badge>
        </div>

        <div className="space-y-1">
          <MobileDataRow
            label="Date"
            value={format(new Date(order.doc_date), "MMM dd, yyyy")}
          />
          <MobileDataRow
            label="Total"
            value={`₱${order.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
          />
          {order.autocount_synced && (
            <MobileDataRow
              label="AutoCount"
              value={
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {order.autocount_doc_no || "Synced"}
                </Badge>
              }
            />
          )}
        </div>
      </div>
    </MobileDataCard>
  );
}
