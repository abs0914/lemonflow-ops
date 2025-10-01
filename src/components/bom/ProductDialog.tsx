import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProductFormData {
  name: string;
  sku: string;
  description: string;
  unit: string;
}

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: { id: string; name: string; sku: string; description: string | null; unit: string } | null;
}

export function ProductDialog({ open, onOpenChange, product }: ProductDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductFormData>();

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        sku: product.sku,
        description: product.description || "",
        unit: product.unit,
      });
    } else {
      reset({ name: "", sku: "", description: "", unit: "unit" });
    }
  }, [product, reset]);

  const mutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      if (product) {
        const { error } = await supabase
          .from("products")
          .update(data)
          .eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: `Product ${product ? "updated" : "created"} successfully` });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: `Error ${product ? "updating" : "creating"} product`,
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProductFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" {...register("sku", { required: "SKU is required" })} />
            {errors.sku && <span className="text-sm text-destructive">{errors.sku.message}</span>}
          </div>

          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name", { required: "Name is required" })} />
            {errors.name && <span className="text-sm text-destructive">{errors.name.message}</span>}
          </div>

          <div>
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" {...register("unit", { required: "Unit is required" })} placeholder="e.g., pcs, kg, liter" />
            {errors.unit && <span className="text-sm text-destructive">{errors.unit.message}</span>}
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register("description")} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}