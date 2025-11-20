import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Component } from "@/types/inventory";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface EditInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  component: Component | null;
}

interface InventoryFormData {
  sku: string;
  name: string;
  description: string;
  item_group: string;
  item_type: string;
  unit: string;
  stock_quantity: number;
  cost_per_unit: number;
  price: number;
  stock_control: boolean;
  has_batch_no: boolean;
  sync_to_autocount: boolean;
}

export function EditInventoryDialog({ open, onOpenChange, component }: EditInventoryDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InventoryFormData>({
    defaultValues: {
      stock_control: true,
      has_batch_no: false,
      sync_to_autocount: true,
      unit: "unit",
      item_type: "CONSUMABLE",
      stock_quantity: 0,
      cost_per_unit: 0,
      price: 0,
    },
  });

  const syncToAutocount = watch("sync_to_autocount");

  // Populate form when component changes
  useEffect(() => {
    if (component) {
      reset({
        sku: component.sku,
        name: component.name,
        description: component.description || "",
        item_group: component.item_group || "",
        item_type: component.item_type || "CONSUMABLE",
        unit: component.unit,
        stock_quantity: component.stock_quantity,
        cost_per_unit: component.cost_per_unit || 0,
        price: component.price || 0,
        stock_control: component.stock_control ?? true,
        has_batch_no: component.has_batch_no ?? false,
        sync_to_autocount: true,
      });
    }
  }, [component, reset]);

  const updateItemMutation = useMutation({
    mutationFn: async (data: InventoryFormData) => {
      if (!component) throw new Error("No component selected");

      // Update item in Supabase
      const { error: updateError } = await supabase
        .from("components")
        .update({
          sku: data.sku,
          name: data.name,
          description: data.description || null,
          item_group: data.item_group || null,
          item_type: data.item_type,
          unit: data.unit,
          stock_quantity: data.stock_quantity,
          cost_per_unit: data.cost_per_unit,
          price: data.price,
          stock_control: data.stock_control,
          has_batch_no: data.has_batch_no,
        })
        .eq("id", component.id);

      if (updateError) throw updateError;

      // Sync to AutoCount if requested
      if (data.sync_to_autocount) {
        setIsSyncing(true);
        
        const { error: syncError } = await supabase.functions.invoke(
          "update-autocount-item",
          {
            body: {
              itemCode: component.autocount_item_code || data.sku,
              description: data.name,
              itemGroup: data.item_group,
              itemType: data.item_type,
              baseUom: data.unit,
              stockControl: data.stock_control,
              hasBatchNo: data.has_batch_no,
              standardCost: data.cost_per_unit,
              price: data.price,
            },
          }
        );

        if (syncError) {
          console.error("AutoCount sync error:", syncError);
          toast({
            title: "Item updated but sync failed",
            description: "Item was updated in inventory but could not be synced to AutoCount",
            variant: "destructive",
          });
        } else {
          // Update the last synced timestamp
          await supabase
            .from("components")
            .update({
              last_synced_at: new Date().toISOString(),
            })
            .eq("id", component.id);
        }
        
        setIsSyncing(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["item-groups"] });
      queryClient.invalidateQueries({ queryKey: ["item-types"] });
      
      toast({
        title: "Item Updated",
        description: syncToAutocount
          ? "Item updated and synced to AutoCount successfully"
          : "Item updated in inventory successfully",
      });
      
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InventoryFormData) => {
    updateItemMutation.mutate(data);
  };

  if (!component) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Inventory Item</DialogTitle>
          <DialogDescription>
            Update inventory item details. Optionally sync changes to AutoCount.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU / Item Code *</Label>
              <Input
                id="sku"
                {...register("sku", { required: "SKU is required" })}
                placeholder="e.g., ITM-001"
              />
              {errors.sku && (
                <p className="text-sm text-destructive">{errors.sku.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Item Name *</Label>
              <Input
                id="name"
                {...register("name", { required: "Name is required" })}
                placeholder="e.g., Steel Pipe"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Item description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item_group">Item Group</Label>
              <Input
                id="item_group"
                {...register("item_group")}
                placeholder="e.g., Raw Materials"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item_type">Item Type *</Label>
              <Select
                value={watch("item_type")}
                onValueChange={(value) => setValue("item_type", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONSUMABLE">Consumable</SelectItem>
                  <SelectItem value="FINISHED_GOODS">Finished Goods</SelectItem>
                  <SelectItem value="RAW_MATERIAL">Raw Material</SelectItem>
                  <SelectItem value="COMPONENT">Component</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit">Unit *</Label>
              <Input
                id="unit"
                {...register("unit", { required: "Unit is required" })}
                placeholder="e.g., pcs, kg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock_quantity">Stock Quantity</Label>
              <Input
                id="stock_quantity"
                type="number"
                step="0.01"
                {...register("stock_quantity", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost_per_unit">Cost per Unit</Label>
              <Input
                id="cost_per_unit"
                type="number"
                step="0.01"
                {...register("cost_per_unit", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Selling Price</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              {...register("price", { valueAsNumber: true })}
            />
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="stock_control"
                checked={watch("stock_control")}
                onCheckedChange={(checked) =>
                  setValue("stock_control", checked as boolean)
                }
              />
              <Label htmlFor="stock_control" className="font-normal cursor-pointer">
                Enable stock control
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="has_batch_no"
                checked={watch("has_batch_no")}
                onCheckedChange={(checked) =>
                  setValue("has_batch_no", checked as boolean)
                }
              />
              <Label htmlFor="has_batch_no" className="font-normal cursor-pointer">
                Has batch number
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sync_to_autocount"
                checked={watch("sync_to_autocount")}
                onCheckedChange={(checked) =>
                  setValue("sync_to_autocount", checked as boolean)
                }
              />
              <Label htmlFor="sync_to_autocount" className="font-normal cursor-pointer">
                Sync changes to AutoCount
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateItemMutation.isPending || isSyncing}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateItemMutation.isPending || isSyncing}
            >
              {(updateItemMutation.isPending || isSyncing) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isSyncing ? "Syncing..." : "Update Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}