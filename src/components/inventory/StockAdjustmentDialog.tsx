import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ActionSheet } from "@/components/ui/action-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";

interface StockAdjustmentFormData {
  movement_type: string;
  quantity: string;
  notes: string;
  reason: string;
  location: string;
  batch_number: string;
  sync_to_autocount: boolean;
}

interface StockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: "product" | "component";
  itemId: string;
  itemName: string;
  itemSku: string;
  currentStock: number;
  itemUnit: string;
  hasBatchNo?: boolean;
}

export function StockAdjustmentDialog({
  open,
  onOpenChange,
  itemType,
  itemId,
  itemName,
  itemSku,
  currentStock,
  itemUnit,
  hasBatchNo = false,
}: StockAdjustmentDialogProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [isSyncing, setIsSyncing] = useState(false);
  
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<StockAdjustmentFormData>({
    defaultValues: {
      movement_type: "receipt",
      quantity: "",
      notes: "",
      reason: "Stock Count",
      location: "MAIN",
      batch_number: "",
      sync_to_autocount: true,
    },
  });

  const movementType = watch("movement_type");
  const syncToAutocount = watch("sync_to_autocount");

  useEffect(() => {
    if (open) {
      reset({
        movement_type: "receipt",
        quantity: "",
        notes: "",
        reason: "Stock Count",
        location: "MAIN",
        batch_number: "",
        sync_to_autocount: true,
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

      // Insert stock movement
      const { error: movementError } = await supabase.from("stock_movements").insert([{
        movement_type: data.movement_type,
        item_type: itemType,
        item_id: itemId,
        quantity: quantity,
        reference_type: "manual_adjustment",
        notes: `${data.reason}${data.notes ? ': ' + data.notes : ''}`,
        performed_by: profile.id,
        warehouse_location: data.location,
        batch_number: data.batch_number || null,
      }]);

      if (movementError) throw movementError;

      // Sync to AutoCount if requested
      if (data.sync_to_autocount) {
        setIsSyncing(true);
        
        let adjustmentType: "IN" | "OUT" | "SET" = "IN";
        if (data.movement_type === "issue") {
          adjustmentType = "OUT";
        } else if (data.movement_type === "adjustment") {
          adjustmentType = "SET";
        }

        const { error: syncError } = await supabase.functions.invoke(
          "sync-stock-adjustment",
          {
            body: {
              itemCode: itemSku,
              location: data.location,
              adjustmentType: adjustmentType,
              quantity: data.movement_type === "adjustment" ? parseFloat(data.quantity) : Math.abs(quantity),
              uom: itemUnit,
              description: itemName,
              batchNumber: data.batch_number || undefined,
              reason: data.reason,
            },
          }
        );

        if (syncError) {
          console.error("AutoCount sync error:", syncError);
          
          // Check if it's a 404 error (item doesn't exist in AutoCount)
          const errorMessage = syncError.message || '';
          if (errorMessage.includes('does not exist in AutoCount')) {
            toast({
              title: "Item not found in AutoCount",
              description: errorMessage,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Stock adjusted but sync failed",
              description: "Stock was updated locally but could not be synced to AutoCount",
              variant: "destructive",
            });
          }
        }
        
        setIsSyncing(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["components"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      toast({ 
        title: "Stock updated successfully",
        description: syncToAutocount ? "Changes synced to AutoCount" : undefined
      });
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="reason">Reason *</Label>
          <Select
            value={watch("reason")}
            onValueChange={(value) => setValue("reason", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Stock Count">Stock Count</SelectItem>
              <SelectItem value="Damage">Damage</SelectItem>
              <SelectItem value="Lost">Lost</SelectItem>
              <SelectItem value="Return">Return</SelectItem>
              <SelectItem value="Transfer">Transfer</SelectItem>
              <SelectItem value="Production">Production</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="location">Location/Warehouse *</Label>
          <Input
            id="location"
            {...register("location", { required: "Location is required" })}
            placeholder="e.g., MAIN, HQ, PJ"
          />
        </div>
      </div>

      {hasBatchNo && (
        <div>
          <Label htmlFor="batch_number">Batch Number</Label>
          <Input
            id="batch_number"
            {...register("batch_number")}
            placeholder="Enter batch number"
          />
        </div>
      )}

      <div>
        <Label htmlFor="notes">Additional Notes</Label>
        <Textarea
          id="notes"
          {...register("notes")}
          placeholder="Optional additional notes"
          rows={2}
        />
      </div>

      <div className="flex items-center space-x-2 pt-2">
        <Checkbox
          id="sync_to_autocount"
          checked={watch("sync_to_autocount")}
          onCheckedChange={(checked) =>
            setValue("sync_to_autocount", checked as boolean)
          }
        />
        <Label htmlFor="sync_to_autocount" className="font-normal cursor-pointer">
          Sync to AutoCount
        </Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => onOpenChange(false)}
          disabled={mutation.isPending || isSyncing}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={mutation.isPending || isSyncing}
        >
          {(mutation.isPending || isSyncing) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {isSyncing ? "Syncing..." : mutation.isPending ? "Updating..." : "Update Stock"}
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
