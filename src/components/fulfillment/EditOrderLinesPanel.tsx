import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { SalesOrderLine } from "@/types/sales-order";
import { useFulfillmentLineMutations } from "@/hooks/useFulfillmentLineMutations";
import { ItemSelector } from "@/components/store-orders/ItemSelector";

interface Props {
  orderId: string;
  lines: SalesOrderLine[];
}

export function EditOrderLinesPanel({ orderId, lines }: Props) {
  const { updateLine, deleteLine, addLine } = useFulfillmentLineMutations(orderId);
  const [editing, setEditing] = useState<SalesOrderLine | null>(null);
  const [deleting, setDeleting] = useState<SalesOrderLine | null>(null);
  const [adding, setAdding] = useState<any | null>(null);
  const [showAddPicker, setShowAddPicker] = useState(false);

  const [editQty, setEditQty] = useState("0");
  const [editPrice, setEditPrice] = useState("0");
  const [reason, setReason] = useState("");

  const openEdit = (l: SalesOrderLine) => {
    setEditing(l);
    setEditQty(String(l.quantity));
    setEditPrice(String(l.unit_price));
    setReason("");
  };

  const total = lines.reduce((s, l) => s + Number(l.sub_total || 0), 0);
  const busy = updateLine.isPending || deleteLine.isPending || addLine.isPending;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Changes are logged in the order's change history.
        </p>
        <Button size="sm" variant="outline" onClick={() => setShowAddPicker(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Item
        </Button>
      </div>

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
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  No items. Click "Add Item" to add one.
                </TableCell>
              </TableRow>
            )}
            {lines.map((line, idx) => (
              <TableRow key={line.id}>
                <TableCell>{line.line_number || idx + 1}</TableCell>
                <TableCell>{line.item_code}</TableCell>
                <TableCell>{line.item_name}</TableCell>
                <TableCell className="text-right">{line.quantity}</TableCell>
                <TableCell>{line.uom}</TableCell>
                <TableCell className="text-right">
                  ₱{Number(line.unit_price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right font-medium">
                  ₱{Number(line.sub_total).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(line)} disabled={busy}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => { setDeleting(line); setReason(""); }} disabled={busy}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <div className="bg-muted/50 rounded-lg p-4 min-w-[250px] flex justify-between items-center">
          <span className="text-lg font-semibold">Total:</span>
          <span className="text-2xl font-bold text-primary">
            ₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Line Item</DialogTitle>
            <DialogDescription>{editing?.item_name} ({editing?.item_code})</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantity</Label>
                <Input type="number" min="0" step="0.01" value={editQty} onChange={(e) => setEditQty(e.target.value)} />
              </div>
              <div>
                <Label>Unit Price</Label>
                <Input type="number" min="0" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              New subtotal: ₱{(parseFloat(editQty || "0") * parseFloat(editPrice || "0")).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </div>
            <div>
              <Label>Reason for change <span className="text-destructive">*</span></Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why is this changing?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              disabled={!reason.trim() || updateLine.isPending}
              onClick={async () => {
                if (!editing) return;
                await updateLine.mutateAsync({
                  lineId: editing.id,
                  quantity: parseFloat(editQty) || 0,
                  unit_price: parseFloat(editPrice) || 0,
                  reason,
                });
                setEditing(null);
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Line Item</DialogTitle>
            <DialogDescription>
              Remove <strong>{deleting?.item_name}</strong> from the order?
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Reason for removal <span className="text-destructive">*</span></Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || deleteLine.isPending}
              onClick={async () => {
                if (!deleting) return;
                await deleteLine.mutateAsync({ lineId: deleting.id, reason });
                setDeleting(null);
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add picker */}
      <Dialog open={showAddPicker} onOpenChange={(o) => { if (!o) { setShowAddPicker(false); setAdding(null); setReason(""); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Item to Order</DialogTitle>
          </DialogHeader>
          {!adding ? (
            <ItemSelector onAddItem={(item) => setAdding(item)} />
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border p-3 text-sm">
                <div><strong>{adding.item_name}</strong> ({adding.item_code})</div>
                <div className="text-muted-foreground">
                  Qty: {adding.quantity} {adding.uom} × ₱{Number(adding.unit_price).toFixed(2)} = ₱{Number(adding.sub_total).toFixed(2)}
                </div>
              </div>
              <div>
                <Label>Reason for adding <span className="text-destructive">*</span></Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddPicker(false); setAdding(null); setReason(""); }}>Cancel</Button>
            {adding && (
              <Button
                disabled={!reason.trim() || addLine.isPending}
                onClick={async () => {
                  await addLine.mutateAsync({ line: adding, reason });
                  setShowAddPicker(false);
                  setAdding(null);
                  setReason("");
                }}
              >
                Add to Order
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
