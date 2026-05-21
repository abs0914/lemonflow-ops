import { SalesOrderLine } from "@/types/sales-order";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAvailableForCode, useInventoryItems } from "@/hooks/useInventoryItems";

interface OrderLineFormProps {
  lines: Omit<SalesOrderLine, 'id' | 'sales_order_id' | 'created_at' | 'updated_at'>[];
  onRemoveLine: (index: number) => void;
  readOnly?: boolean;
}

export function OrderLineForm({ lines, onRemoveLine, readOnly = false }: OrderLineFormProps) {
  const { data: items } = useInventoryItems();
  const total = lines.reduce((sum, line) => sum + line.sub_total, 0);

  if (lines.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/30">
        No items added yet. Use the item selector above to add items to this order.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Item Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead>UOM</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              {!readOnly && <TableHead className="w-12"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, index) => {
              const available = getAvailableForCode(line.item_code, items);
              const exceeds = available !== null && line.quantity > available;
              return (
                <TableRow key={index} className={exceeds ? "bg-destructive/5" : ""}>
                  <TableCell className="font-medium">{line.line_number || index + 1}</TableCell>
                  <TableCell>{line.item_code}</TableCell>
                  <TableCell>{line.item_name}</TableCell>
                  <TableCell className={`text-right ${exceeds ? "text-destructive font-semibold" : ""}`}>
                    {line.quantity}
                  </TableCell>
                  <TableCell className="text-right">
                    {available === null ? (
                      <span className="text-muted-foreground text-xs">—</span>
                    ) : exceeds ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {available}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">{available}</span>
                    )}
                  </TableCell>
                  <TableCell>{line.uom}</TableCell>
                  <TableCell className="text-right">
                    ₱{line.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₱{line.sub_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveLine(index)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <div className="bg-muted/50 rounded-lg p-4 min-w-[250px]">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">Total Amount:</span>
            <span className="text-2xl font-bold text-primary">
              ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
