import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useSupplier } from "@/hooks/useSuppliers";

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId?: string;
}

interface SupplierFormData {
  supplier_code: string;
  company_name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  credit_terms: number;
  is_active: boolean;
}

export function SupplierDialog({ open, onOpenChange, supplierId }: SupplierDialogProps) {
  const queryClient = useQueryClient();
  const { data: supplier } = useSupplier(supplierId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<SupplierFormData>({
    defaultValues: {
      is_active: true,
      credit_terms: 0,
    },
  });

  const isActive = watch("is_active");

  useEffect(() => {
    if (supplier) {
      reset({
        supplier_code: supplier.supplier_code,
        company_name: supplier.company_name,
        contact_person: supplier.contact_person || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        address: supplier.address || "",
        credit_terms: supplier.credit_terms || 0,
        is_active: supplier.is_active,
      });
    } else {
      reset({
        is_active: true,
        credit_terms: 0,
      });
    }
  }, [supplier, reset]);

  const onSubmit = async (data: SupplierFormData) => {
    try {
      if (supplierId) {
        const { error } = await supabase
          .from("suppliers")
          .update(data)
          .eq("id", supplierId);

        if (error) throw error;
        toast.success("Supplier updated successfully");
      } else {
        const { error } = await supabase.from("suppliers").insert([data]);

        if (error) throw error;
        toast.success("Supplier created successfully");
      }

      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save supplier");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplierId ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier_code">Supplier Code *</Label>
              <Input
                id="supplier_code"
                {...register("supplier_code", { required: "Supplier code is required" })}
                placeholder="SUP001"
              />
              {errors.supplier_code && (
                <p className="text-sm text-destructive">{errors.supplier_code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input
                id="company_name"
                {...register("company_name", { required: "Company name is required" })}
                placeholder="ABC Supplies"
              />
              {errors.company_name && (
                <p className="text-sm text-destructive">{errors.company_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                {...register("contact_person")}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                {...register("phone")}
                placeholder="+60 12-345 6789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="contact@supplier.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="credit_terms">Credit Terms (days)</Label>
              <Input
                id="credit_terms"
                type="number"
                {...register("credit_terms", { valueAsNumber: true })}
                placeholder="30"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              {...register("address")}
              placeholder="Full address..."
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={(checked) => setValue("is_active", checked)}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : supplierId ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
