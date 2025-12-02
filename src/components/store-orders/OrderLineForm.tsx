import { SalesOrderLine } from "@/types/sales-order";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface OrderLineFormProps {
  lines: Omit<SalesOrderLine, 'id' | 'sales_order_id' | 'created_at' | 'updated_at'>[];
  onRemoveLine: (index: number) => void;
  readOnly?: boolean;
}

export function OrderLineForm({ lines, onRemoveLine, readOnly = false }: OrderLineFormProps) {
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
              <TableHead>UOM</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              {!readOnly && <TableHead className="w-12"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{line.line_number || index + 1}</TableCell>
                <TableCell>{line.item_code}</TableCell>
                <TableCell>{line.item_name}</TableCell>
                <TableCell className="text-right">{line.quantity}</TableCell>
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
            ))}
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
