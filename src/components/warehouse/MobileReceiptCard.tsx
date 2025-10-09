import { MobileDataCard, MobileDataRow } from "@/components/ui/mobile-data-card";
import { Badge } from "@/components/ui/badge";
import { Package, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface StockMovement {
  id: string;
  movement_type: string;
  quantity: number;
  unit_received: string | null;
  batch_number: string | null;
  supplier_reference: string | null;
  warehouse_location: string | null;
  notes: string | null;
  created_at: string;
  autocount_synced: boolean;
  components?: {
    name: string;
    sku: string;
  };
}

interface MobileReceiptCardProps {
  receipt: StockMovement;
}

export function MobileReceiptCard({ receipt }: MobileReceiptCardProps) {
  const expandableContent = (
    <div className="space-y-2 pt-2 border-t">
      <MobileDataRow label="SKU" value={receipt.components?.sku || "-"} />
      {receipt.batch_number && (
        <MobileDataRow label="Batch #" value={receipt.batch_number} />
      )}
      {receipt.supplier_reference && (
        <MobileDataRow label="Supplier Ref" value={receipt.supplier_reference} />
      )}
      {receipt.warehouse_location && (
        <MobileDataRow label="Location" value={receipt.warehouse_location} />
      )}
      {receipt.notes && (
        <MobileDataRow label="Notes" value={receipt.notes} />
      )}
      <MobileDataRow 
        label="Received" 
        value={formatDistanceToNow(new Date(receipt.created_at), { addSuffix: true })} 
      />
    </div>
  );

  return (
    <MobileDataCard expandableContent={expandableContent}>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm text-muted-foreground">
                Stock Receipt
              </span>
            </div>
            <h3 className="font-semibold mt-1">{receipt.components?.name}</h3>
          </div>
          {receipt.autocount_synced ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Synced
            </Badge>
          ) : (
            <Badge variant="secondary">Pending</Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Quantity</p>
            <p className="text-lg font-bold">
              {receipt.quantity} {receipt.unit_received || 'units'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="text-sm font-medium capitalize">
              {receipt.movement_type.replace('_', ' ')}
            </p>
          </div>
        </div>
      </div>
    </MobileDataCard>
  );
}