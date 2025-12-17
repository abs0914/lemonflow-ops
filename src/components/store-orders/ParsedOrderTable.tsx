import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Check, AlertTriangle, Edit2 } from "lucide-react";
import { ParsedOrderItem } from "@/lib/orderParser";
import { ComponentItem } from "@/hooks/useValidateItemCodes";

interface ParsedOrderTableProps {
  items: ParsedOrderItem[];
  onItemsChange: (items: ParsedOrderItem[]) => void;
  itemDetails?: Map<string, ComponentItem>;
}

export function ParsedOrderTable({
  items,
  onItemsChange,
  itemDetails,
}: ParsedOrderTableProps) {
  const [editingRow, setEditingRow] = useState<number | null>(null);

  const handleFieldChange = (
    index: number,
    field: keyof ParsedOrderItem,
    value: string | number
  ) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: field === "quantity" ? Number(value) || 0 : value,
    };
    onItemsChange(updated);
  };

  const handleDeleteRow = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onItemsChange(updated);
  };

  const handleAddRow = () => {
    const newItem: ParsedOrderItem = {
      itemCode: "",
      quantity: 1,
      notes: "",
      isValid: false,
    };
    onItemsChange([...items, newItem]);
    setEditingRow(items.length);
  };

  const validCount = items.filter((item) => item.isValid).length;
  const invalidCount = items.filter((item) => item.isValid === false).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">
            {items.length} item{items.length !== 1 ? "s" : ""} parsed
          </span>
          {validCount > 0 && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Check className="mr-1 h-3 w-3" />
              {validCount} valid
            </Badge>
          )}
          {invalidCount > 0 && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {invalidCount} unrecognized
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleAddRow}>
          <Plus className="mr-2 h-4 w-4" />
          Add Row
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Item Code</TableHead>
              <TableHead>Item Name</TableHead>
              <TableHead className="w-[80px]">Qty</TableHead>
              <TableHead className="w-[100px]">Unit</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No items parsed yet. Paste an order message and click "Parse Order".
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => {
                const isEditing = editingRow === index;
                const componentInfo = itemDetails?.get(item.itemCode);

                return (
                  <TableRow
                    key={index}
                    className={item.isValid === false ? "bg-yellow-50/50" : ""}
                  >
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={item.itemCode}
                          onChange={(e) =>
                            handleFieldChange(index, "itemCode", e.target.value.toUpperCase())
                          }
                          className="h-8"
                          placeholder="TLC00001"
                        />
                      ) : (
                        <code className="text-sm font-medium">{item.itemCode}</code>
                      )}
                    </TableCell>
                    <TableCell>
                      {componentInfo?.name || (
                        <span className="text-muted-foreground italic">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleFieldChange(index, "quantity", e.target.value)
                          }
                          className="h-8 w-16"
                        />
                      ) : (
                        <span className="font-medium">{item.quantity}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {componentInfo?.unit || "Unknown"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={item.notes}
                          onChange={(e) =>
                            handleFieldChange(index, "notes", e.target.value)
                          }
                          className="h-8"
                          placeholder="Notes"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {item.notes || "-"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.isValid ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <Check className="h-3 w-3" />
                        </Badge>
                      ) : item.isValid === false ? (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          <AlertTriangle className="h-3 w-3" />
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingRow(isEditing ? null : index)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteRow(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
