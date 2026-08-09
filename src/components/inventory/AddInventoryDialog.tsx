import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface AddInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isRawMaterial?: boolean;
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
  visible_in_store_orders: boolean;
}

export function AddInventoryDialog({ open, onOpenChange, isRawMaterial = false }: AddInventoryDialogProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isSyncing] = useState(false);
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  
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
      visible_in_store_orders: false,
      unit: "unit",
      item_type: "CONSUMABLE",
      stock_quantity: 0,
      cost_per_unit: 0,
      price: 0,
    },
  });


  // Auto-generate item code when dialog opens
  useEffect(() => {
    const generateItemCode = async () => {
      if (open) {
        setIsLoadingCode(true);
        try {
          const rpcFunction = isRawMaterial ? 'get_next_raw_material_code' : 'get_next_item_code';
          const { data, error } = await supabase.rpc(rpcFunction);
          
          if (error) {
            console.error('Error generating item code:', error);
            toast({
              title: "Error",
              description: "Failed to generate item code",
              variant: "destructive",
            });
            return;
          }
          
          if (data) {
            setValue('sku', data);
          }
        } catch (error) {
          console.error('Error generating item code:', error);
        } finally {
          setIsLoadingCode(false);
        }
      }
    };

    generateItemCode();
  }, [open, setValue, toast, isRawMaterial]);

  const createItemMutation = useMutation({
    mutationFn: async (data: InventoryFormData) => {
      // Create item in appropriate table
      const tableName = isRawMaterial ? "raw_materials" : "components";
      const { data: newItem, error: insertError } = await supabase
        .from(tableName)
        .insert({
          sku: data.sku,
          autocount_item_code: data.sku,
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
          ...(isRawMaterial ? {} : { visible_in_store_orders: data.visible_in_store_orders }),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return newItem;
    },
    onSuccess: () => {
      const queryKey = isRawMaterial ? "raw-materials" : "inventory";
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      queryClient.invalidateQueries({ queryKey: ["item-groups"] });
      queryClient.invalidateQueries({ queryKey: ["item-types"] });
      
      toast({
        title: "Item Created",
        description: isRawMaterial
          ? "Raw material created successfully"
          : "Item created in inventory successfully",
      });
      
      reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InventoryFormData) => {
    createItemMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isRawMaterial ? "Add New Raw Material" : "Add New Inventory Item"}
          </DialogTitle>
          <DialogDescription>
            {isRawMaterial
              ? "Create a new raw material for production"
              : "Create a new inventory item."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU / Item Code *</Label>
              <Input
                id="sku"
                {...register("sku", { required: "SKU is required" })}
                placeholder="TLC00001"
                readOnly
                className="bg-muted cursor-not-allowed font-mono"
                disabled={isLoadingCode}
              />
              <p className="text-xs text-muted-foreground">
                {isRawMaterial
                  ? "Auto-generated in format TLC-RAW-00XXX"
                  : "Auto-generated in format TLCXXXXX"}
              </p>
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
              <Label htmlFor="stock_quantity">Initial Stock</Label>
              <Input
                id="stock_quantity"
                type="number"
                step="0.01"
                {...register("stock_quantity", { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">
                Set to 0 and use "Adjust Stock" after creation for proper tracking
              </p>
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

            {!isRawMaterial && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="visible_in_store_orders"
                  checked={watch("visible_in_store_orders")}
                  onCheckedChange={(checked) =>
                    setValue("visible_in_store_orders", checked as boolean)
                  }
                />
                <Label htmlFor="visible_in_store_orders" className="font-normal cursor-pointer">
                  Show in Store Orders (visible to franchisees)
                </Label>
              </div>
            )}


          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              disabled={createItemMutation.isPending || isSyncing}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createItemMutation.isPending || isSyncing}
            >
              {(createItemMutation.isPending || isSyncing) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isSyncing ? "Syncing..." : "Create Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
