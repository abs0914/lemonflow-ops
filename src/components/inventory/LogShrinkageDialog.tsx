import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Scale } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetRawMaterialId?: string;
}

type Mode = "loss" | "recount";

export function LogShrinkageDialog({ open, onOpenChange, presetRawMaterialId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [rawMaterialId, setRawMaterialId] = useState<string>(presetRawMaterialId ?? "");
  const [mode, setMode] = useState<Mode>("loss");
  const [lossInput, setLossInput] = useState<string>("");
  const [recountInput, setRecountInput] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (open) {
      setRawMaterialId(presetRawMaterialId ?? "");
      setMode("loss");
      setLossInput("");
      setRecountInput("");
      setNotes("");
    }
  }, [open, presetRawMaterialId]);

  const { data: items } = useQuery({
    queryKey: ["perishable-raw-materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raw_materials")
        .select("id, sku, name, unit, stock_quantity")
        .eq("is_perishable", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const selected = useMemo(
    () => items?.find((i: any) => i.id === rawMaterialId),
    [items, rawMaterialId]
  );

  const lossQty = useMemo(() => {
    if (mode === "loss") {
      const v = parseFloat(lossInput);
      return Number.isFinite(v) ? v : 0;
    }
    if (!selected) return 0;
    const r = parseFloat(recountInput);
    if (!Number.isFinite(r)) return 0;
    return Math.max(0, Number(selected.stock_quantity) - r);
  }, [mode, lossInput, recountInput, selected]);

  const newQty = useMemo(() => {
    if (!selected) return 0;
    return Math.max(0, Number(selected.stock_quantity) - lossQty);
  }, [selected, lossQty]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!rawMaterialId) throw new Error("Select a perishable raw material");
      if (lossQty <= 0) throw new Error("Loss quantity must be greater than 0");
      if (!notes.trim()) throw new Error("Reason / notes are required");

      const { data, error } = await supabase.rpc("post_shrinkage_adjustment", {
        p_raw_material_id: rawMaterialId,
        p_loss_quantity: lossQty,
        p_notes: notes.trim(),
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      toast({
        title: "Shrinkage logged",
        description: `${selected?.name}: -${lossQty} ${selected?.unit}. New stock: ${data?.new_quantity ?? newQty}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      queryClient.invalidateQueries({ queryKey: ["perishable-raw-materials"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Failed to log shrinkage", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-amber-600" />
            Log Shrinkage / Weight Loss
          </DialogTitle>
          <DialogDescription>
            Write down stock for perishable raw materials that have lost weight in storage.
            This is recorded as a stock movement and reduces available stock.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Perishable Raw Material *</Label>
            <Select value={rawMaterialId} onValueChange={setRawMaterialId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an item..." />
              </SelectTrigger>
              <SelectContent>
                {items && items.length > 0 ? (
                  items.map((it: any) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.name} ({it.sku}) — {it.stock_quantity} {it.unit}
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-3 text-sm text-muted-foreground">
                    No perishable raw materials. Mark items as perishable first.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {selected && (
            <div className="rounded-md bg-muted p-3 text-sm">
              Current stock: <span className="font-semibold">{selected.stock_quantity} {selected.unit}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label>Method</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="loss">Enter weight lost</SelectItem>
                <SelectItem value="recount">Enter recounted weight</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "loss" ? (
            <div className="space-y-2">
              <Label htmlFor="loss">Weight lost ({selected?.unit ?? "unit"}) *</Label>
              <Input
                id="loss"
                type="number"
                step="0.01"
                min="0"
                value={lossInput}
                onChange={(e) => setLossInput(e.target.value)}
                placeholder="e.g. 0.5"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="recount">Recounted weight ({selected?.unit ?? "unit"}) *</Label>
              <Input
                id="recount"
                type="number"
                step="0.01"
                min="0"
                value={recountInput}
                onChange={(e) => setRecountInput(e.target.value)}
                placeholder="What you weighed today"
              />
            </div>
          )}

          {selected && lossQty > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm space-y-1">
              <div>Loss: <span className="font-semibold text-amber-700 dark:text-amber-400">-{lossQty} {selected.unit}</span></div>
              <div>New stock after adjustment: <span className="font-semibold">{newQty} {selected.unit}</span></div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Reason / Notes *</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Mango weight loss after 5 days storage; recounted by Juan"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submit.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || lossQty <= 0 || !rawMaterialId || !notes.trim()}
          >
            {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Log Shrinkage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
