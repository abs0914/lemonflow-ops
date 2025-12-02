import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInventoryItems } from "@/hooks/useInventoryItems";
import { Plus, Search } from "lucide-react";
import { SalesOrderLine } from "@/types/sales-order";

interface ItemSelectorProps {
  onAddItem: (item: Omit<SalesOrderLine, 'id' | 'sales_order_id' | 'created_at' | 'updated_at' | 'line_number'>) => void;
}

export function ItemSelector({ onAddItem }: ItemSelectorProps) {
  const { data: items, isLoading } = useInventoryItems();
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredItems = items?.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    setSearchTerm("");
  };

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
      <h3 className="font-semibold text-foreground">Add Item</h3>
      
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="item-search">Search Item</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="item-search"
              placeholder="Search by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="item-select">Select Item</Label>
          <Select value={selectedItemId} onValueChange={setSelectedItemId}>
            <SelectTrigger id="item-select">
              <SelectValue placeholder="Choose an item" />
            </SelectTrigger>
            <SelectContent>
              {isLoading ? (
                <div className="p-2 text-sm text-muted-foreground">Loading items...</div>
              ) : filteredItems?.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">No items found</div>
              ) : (
                filteredItems?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{item.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {item.sku} - Stock: {item.stock_quantity}
                      </span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
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
