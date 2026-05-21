import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  item_type: z.enum(["component", "raw_material"]),
  component_id: z.string().min(1, "Please select an item"),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export interface ProductionLogData {
  id: string;
  item_id: string;
  item_type?: string;
  quantity: number;
  notes: string | null;
}

interface LogProductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    component_id: string;
    item_type: "component" | "raw_material";
    quantity: number;
    notes?: string;
  }) => void;
  isLoading?: boolean;
  editingLog?: ProductionLogData | null;
}

export function LogProductionDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  editingLog,
}: LogProductionDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      item_type: "component",
      component_id: "",
      quantity: 1,
      notes: "",
    },
  });

  const itemType = form.watch("item_type");

  React.useEffect(() => {
    if (open) {
      if (editingLog) {
        form.reset({
          item_type: (editingLog.item_type as "component" | "raw_material") || "component",
          component_id: editingLog.item_id,
          quantity: editingLog.quantity,
          notes: editingLog.notes || "",
        });
      } else {
        form.reset({
          item_type: "component",
          component_id: "",
          quantity: 1,
          notes: "",
        });
      }
    }
  }, [open, editingLog, form]);

  // Products with BOMs (component output)
  const { data: products } = useQuery({
    queryKey: ["products-with-bom"],
    queryFn: async () => {
      const { data: bomProducts, error: bomError } = await supabase
        .from("bom_items")
        .select("product_id");
      if (bomError) throw bomError;

      const productIds = [...new Set(bomProducts?.map(b => b.product_id) || [])];
      if (productIds.length === 0) return [];

      const { data, error } = await supabase
        .from("products")
        .select(`id, name, sku, component_id, components(id, name, sku)`)
        .in("id", productIds)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Raw materials (raw material output)
  const { data: rawMaterials } = useQuery({
    queryKey: ["raw-materials-for-production"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raw_materials")
        .select("id, name, sku")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = (data: FormData) => {
    if (!data.component_id || !data.quantity) return;
    onSubmit({
      component_id: data.component_id,
      item_type: data.item_type,
      quantity: data.quantity,
      notes: data.notes,
    });
    form.reset();
  };

  const isEditing = !!editingLog;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Production Log" : "Log Completed Production"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="item_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Type</FormLabel>
                  <Tabs
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue("component_id", "");
                    }}
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="component" disabled={isEditing}>Product</TabsTrigger>
                      <TabsTrigger value="raw_material" disabled={isEditing}>Raw Material</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="component_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{itemType === "raw_material" ? "Raw Material" : "Product"}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isEditing}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={`Select a ${itemType === "raw_material" ? "raw material" : "product"}`} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {itemType === "component" ? (
                        products?.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No products with BOM found
                          </div>
                        ) : (
                          products?.map((product) => (
                            <SelectItem
                              key={product.id}
                              value={product.component_id || product.id}
                            >
                              {product.name} ({product.sku})
                            </SelectItem>
                          ))
                        )
                      ) : rawMaterials?.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          No raw materials found
                        </div>
                      ) : (
                        rawMaterials?.map((rm) => (
                          <SelectItem key={rm.id} value={rm.id}>
                            {rm.name} ({rm.sku})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity Produced</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="0.001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional production details..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (isEditing ? "Saving..." : "Logging...") : (isEditing ? "Save Changes" : "Log Production")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
