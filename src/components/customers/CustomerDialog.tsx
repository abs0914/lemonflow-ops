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
import { useCustomer } from "@/hooks/useCustomers";

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string;
}

interface CustomerFormData {
  customer_code: string;
  company_name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  credit_terms: number;
  is_active: boolean;
}

export function CustomerDialog({ open, onOpenChange, customerId }: CustomerDialogProps) {
  const queryClient = useQueryClient();
  const { data: customer } = useCustomer(customerId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<CustomerFormData>({
    defaultValues: {
      is_active: true,
      credit_terms: 0,
    },
  });

  const isActive = watch("is_active");

  useEffect(() => {
    if (customer) {
      reset({
        customer_code: customer.customer_code,
        company_name: customer.company_name,
        contact_person: customer.contact_person || "",
        phone: customer.phone || "",
        email: customer.email || "",
        address: customer.address || "",
        credit_terms: customer.credit_terms || 0,
        is_active: customer.is_active,
      });
    } else {
      reset({
        is_active: true,
        credit_terms: 0,
      });
    }
  }, [customer, reset]);

  const onSubmit = async (data: CustomerFormData) => {
    try {
      if (customerId) {
        const { error } = await supabase
          .from("customers")
          .update(data)
          .eq("id", customerId);

        if (error) throw error;
        toast.success("Customer updated successfully");
      } else {
        const { error } = await supabase.from("customers").insert([data]);

        if (error) throw error;
        toast.success("Customer created successfully");
      }

      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save customer");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customerId ? "Edit Customer" : "Add Customer"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_code">Customer Code *</Label>
              <Input
                id="customer_code"
                {...register("customer_code", { required: "Customer code is required" })}
                placeholder="CUST001"
              />
              {errors.customer_code && (
                <p className="text-sm text-destructive">{errors.customer_code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input
                id="company_name"
                {...register("company_name", { required: "Company name is required" })}
                placeholder="ABC Company"
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
                placeholder="Jane Smith"
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
                placeholder="contact@customer.com"
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
              {isSubmitting ? "Saving..." : customerId ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
