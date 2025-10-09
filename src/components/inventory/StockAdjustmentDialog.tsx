import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ActionSheet } from "@/components/ui/action-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";

interface StockAdjustmentFormData {
  movement_type: string;
  quantity: string;
  notes: string;
}

interface StockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: "product" | "component";
  itemId: string;
  itemName: string;
  currentStock: number;
}

export function StockAdjustmentDialog({
  open,
  onOpenChange,
  itemType,
  itemId,
  itemName,
  currentStock,
}: StockAdjustmentDialogProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<StockAdjustmentFormData>({
    defaultValues: {
      movement_type: "receipt",
      quantity: "",
      notes: "",
    },
  });

  const movementType = watch("movement_type");

  useEffect(() => {
    if (open) {
      reset({
        movement_type: "receipt",
        quantity: "",
        notes: "",
      });
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: async (data: StockAdjustmentFormData) => {
      if (!profile) throw new Error("Not authenticated");

      let quantity = parseFloat(data.quantity);
      
      // For issue and adjustment (decrease), make quantity negative
      if (data.movement_type === "issue") {
        quantity = -Math.abs(quantity);
      } else if (data.movement_type === "adjustment") {
        // For adjustment, if the new value is less than current, it's negative
        const newStock = parseFloat(data.quantity);
        quantity = newStock - currentStock;
      }

      const { error } = await supabase.from("stock_movements").insert([{
        movement_type: data.movement_type,
        item_type: itemType,
        item_id: itemId,
        quantity: quantity,
        reference_type: "manual_adjustment",
        notes: data.notes || null,
        performed_by: profile.id,
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["components"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      toast({ title: "Stock updated successfully" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating stock",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: StockAdjustmentFormData) => {
    mutation.mutate(data);
  };

  const formContent = (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="p-3 bg-muted rounded-md">
        <p className="text-sm text-muted-foreground">Current Stock</p>
        <p className="text-2xl font-bold">{currentStock}</p>
      </div>

      <div>
        <Label htmlFor="movement_type">Movement Type</Label>
        <Select
          value={movementType}
          onValueChange={(value) => setValue("movement_type", value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="receipt">Receipt (Add Stock)</SelectItem>
            <SelectItem value="issue">Issue (Remove Stock)</SelectItem>
            <SelectItem value="adjustment">Adjustment (Set Stock)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="quantity">
          {movementType === "adjustment" ? "New Stock Level" : "Quantity"}
        </Label>
        <Input
          id="quantity"
          type="number"
          step="0.01"
          {...register("quantity", { 
            required: "Quantity is required",
            min: { value: 0, message: "Quantity must be positive" }
          })}
          placeholder={movementType === "adjustment" ? "Enter new stock level" : "Enter quantity"}
        />
        {errors.quantity && (
          <span className="text-sm text-destructive">{errors.quantity.message}</span>
        )}
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          {...register("notes")}
          placeholder="Optional notes about this stock movement"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Updating..." : "Update Stock"}
        </Button>
      </div>
    </form>
  );

  if (isMobile) {
    return (
      <ActionSheet
        open={open}
        onOpenChange={onOpenChange}
        title={`Adjust Stock - ${itemName}`}
      >
        {formContent}
      </ActionSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock - {itemName}</DialogTitle>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
