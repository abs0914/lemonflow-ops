import { Component } from "@/types/inventory";
import { MobileDataCard, MobileDataRow } from "@/components/ui/mobile-data-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Package } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface MobileInventoryCardProps {
  component: Component;
  onAdjustStock: (component: Component) => void;
}

export function MobileInventoryCard({ component, onAdjustStock }: MobileInventoryCardProps) {
  const available = component.stock_quantity - component.reserved_quantity;

  const getStockStatusBadge = (available: number) => {
    if (available <= 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    } else if (available < 10) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Low Stock</Badge>;
    }
    return <Badge variant="secondary">In Stock</Badge>;
  };

  const actions = (
    <Button
      size="sm"
      variant="outline"
      onClick={() => onAdjustStock(component)}
    >
      <Edit className="h-4 w-4 mr-2" />
      Adjust
    </Button>
  );

  const expandableContent = (
    <div className="space-y-2 pt-2 border-t">
      <MobileDataRow label="Group" value={component.item_group || "-"} />
      <MobileDataRow label="Type" value={component.item_type || "-"} />
      <MobileDataRow label="Reserved" value={component.reserved_quantity.toString()} />
      <MobileDataRow 
        label="Price" 
        value={component.price ? `$${component.price.toFixed(2)}` : "-"} 
      />
      <MobileDataRow 
        label="Cost" 
        value={component.cost_per_unit ? `$${component.cost_per_unit.toFixed(2)}` : "-"} 
      />
      {component.description && (
        <MobileDataRow label="Description" value={component.description} />
      )}
      <MobileDataRow 
        label="Last Synced" 
        value={component.last_synced_at 
          ? formatDistanceToNow(new Date(component.last_synced_at), { addSuffix: true })
          : "Never"
        } 
      />
      <div className="flex gap-2 flex-wrap">
        {component.stock_control && (
          <Badge variant="outline">Stock Control</Badge>
        )}
        {component.has_batch_no && (
          <Badge variant="outline">Batch Tracked</Badge>
        )}
      </div>
    </div>
  );

  return (
    <MobileDataCard
      actions={actions}
      expandableContent={expandableContent}
      onClick={() => onAdjustStock(component)}
      className={
        available <= 0 
          ? "bg-red-50 dark:bg-red-950/20" 
          : available < 10 
          ? "bg-yellow-50 dark:bg-yellow-950/20" 
          : ""
      }
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm text-muted-foreground">
                {component.autocount_item_code || component.sku}
              </span>
            </div>
            <h3 className="font-semibold mt-1">{component.name}</h3>
          </div>
          {getStockStatusBadge(available)}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Stock</p>
            <p className="text-lg font-bold">{component.stock_quantity}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Available</p>
            <p className="text-lg font-bold">{available}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">UOM</p>
            <p className="text-lg font-bold">{component.unit}</p>
          </div>
        </div>
      </div>
    </MobileDataCard>
  );
}