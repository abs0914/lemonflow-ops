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

interface ComponentFormData {
  name: string;
  sku: string;
  description: string;
  unit: string;
  cost_per_unit: string;
}

interface ComponentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  component?: {
    id: string;
    name: string;
    sku: string;
    description: string | null;
    unit: string;
    cost_per_unit: number | null;
  } | null;
}

export function ComponentDialog({ open, onOpenChange, component }: ComponentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ComponentFormData>();

  useEffect(() => {
    if (component) {
      reset({
        name: component.name,
        sku: component.sku,
        description: component.description || "",
        unit: component.unit,
        cost_per_unit: component.cost_per_unit?.toString() || "",
      });
    } else {
      reset({ name: "", sku: "", description: "", unit: "unit", cost_per_unit: "" });
    }
  }, [component, reset]);

  const mutation = useMutation({
    mutationFn: async (data: ComponentFormData) => {
      const payload = {
        ...data,
        cost_per_unit: data.cost_per_unit ? parseFloat(data.cost_per_unit) : null,
      };

      if (component) {
        const { error } = await supabase
          .from("components")
          .update(payload)
          .eq("id", component.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("components").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["components"] });
      toast({ title: `Component ${component ? "updated" : "created"} successfully` });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: `Error ${component ? "updating" : "creating"} component`,
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ComponentFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{component ? "Edit Component" : "Add Component"}</DialogTitle>
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
            <Label htmlFor="cost_per_unit">Cost per Unit</Label>
            <Input
              id="cost_per_unit"
              type="number"
              step="0.01"
              {...register("cost_per_unit")}
              placeholder="0.00"
            />
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