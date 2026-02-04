import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useInventoryItems } from "@/hooks/useInventoryItems";
import { Plus } from "lucide-react";
import { SalesOrderLine } from "@/types/sales-order";

interface ItemSelectorProps {
  onAddItem: (item: Omit<SalesOrderLine, 'id' | 'sales_order_id' | 'created_at' | 'updated_at' | 'line_number'>) => void;
}

export function ItemSelector({ onAddItem }: ItemSelectorProps) {
  const { data: items, isLoading } = useInventoryItems();
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");

  const itemOptions = items?.map((item) => ({
    value: item.id,
    label: `${item.name} (${item.sku}) - Stock: ${item.stock_quantity}`,
  })) || [];

  const handleAddItem = () => {
    const selectedItem = items?.find((i) => i.id === selectedItemId);
    if (!selectedItem || !quantity) return;

    const qty = parseFloat(quantity);
    const price = selectedItem.price || 0;
    const subtotal = qty * price;

    onAddItem({
      item_code: selectedItem.autocount_item_code || selectedItem.sku,
      item_name: selectedItem.name,
      quantity: qty,
      unit_price: price,
      uom: selectedItem.unit,
      sub_total: subtotal,
      discount: "",
      tax_code: "",
      line_remarks: "",
    });

    setSelectedItemId("");
    setQuantity("1");
  };

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
      <h3 className="font-semibold text-foreground">Add Item</h3>
      
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>Select Item</Label>
          <SearchableSelect
            options={itemOptions}
            value={selectedItemId}
            onValueChange={setSelectedItemId}
            placeholder="Search and select an item..."
            searchPlaceholder="Search by name or SKU..."
            emptyMessage={isLoading ? "Loading items..." : "No items found."}
            disabled={isLoading}
          />
        </div>

        {selectedItemId && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Price</Label>
                <Input
                  value={`₱${(items?.find(i => i.id === selectedItemId)?.price || 0).toFixed(2)}`}
                  disabled
                />
              </div>
            </div>

            <Button onClick={handleAddItem} className="w-full" disabled={!quantity}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item to Order
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
