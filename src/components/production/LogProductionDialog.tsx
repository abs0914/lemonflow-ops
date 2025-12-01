import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  component_id: z.string().min(1, "Please select a product"),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface LogProductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    component_id: string;
    quantity: number;
    notes?: string;
  }) => void;
  isLoading?: boolean;
}

export function LogProductionDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
}: LogProductionDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      component_id: "",
      quantity: 1,
      notes: "",
    },
  });

  // Fetch products that have BOMs
  const { data: products } = useQuery({
    queryKey: ["products-with-bom"],
    queryFn: async () => {
      // First get all product IDs that have BOM items
      const { data: bomProducts, error: bomError } = await supabase
        .from("bom_items")
        .select("product_id");

      if (bomError) throw bomError;

      const productIds = [...new Set(bomProducts?.map(b => b.product_id) || [])];

      if (productIds.length === 0) return [];

      // Then fetch those products with their component details
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select(`
          id,
          name,
          sku,
          component_id,
          components(id, name, sku)
        `)
        .in("id", productIds)
        .order("name");

      if (productError) throw productError;

      return productData;
    },
  });

  const handleSubmit = (data: FormData) => {
    // Validate required fields before submission
    if (!data.component_id || !data.quantity) {
      return;
    }
    onSubmit({
      component_id: data.component_id,
      quantity: data.quantity,
      notes: data.notes,
    });
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Log Completed Production</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="component_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products?.length === 0 ? (
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
                    <Input type="number" min="1" {...field} />
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
                {isLoading ? "Logging..." : "Log Production"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
