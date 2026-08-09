import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Store } from "@/types/sales-order";
import { useCreateStore, useUpdateStore, useStores } from "@/hooks/useStores";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Check, AlertCircle } from "lucide-react";

const storeSchema = z.object({
  store_code: z.string().trim().min(1, "Store code is required").max(50, "Store code must be less than 50 characters"),
  store_name: z.string().trim().min(1, "Store name is required").max(200, "Store name must be less than 200 characters"),
  store_type: z.enum(["own_store", "franchisee"], { required_error: "Store type is required" }),
  debtor_code: z.string().trim().min(1, "Debtor code is required").max(50, "Debtor code must be less than 50 characters"),
  address: z.string().trim().max(500, "Address must be less than 500 characters").optional(),
  contact_person: z.string().trim().max(200, "Contact person must be less than 200 characters").optional(),
  phone: z.string().trim().max(20, "Phone must be less than 20 characters").optional(),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters").optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

type StoreFormData = z.infer<typeof storeSchema>;

interface StoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store?: Store;
}

function generateNextStoreCode(stores: Store[] | undefined, storeType: "own_store" | "franchisee"): string {
  // Use different prefix based on store type
  const prefix = storeType === "franchisee" ? "FRC-TLC-" : "STR-TLC-";
  const codePattern = storeType === "franchisee" 
    ? /^FRC-TLC-(\d{3})$/ 
    : /^STR-TLC-(\d{3})$/;

  if (!stores || stores.length === 0) {
    return `${prefix}001`;
  }

  // Find the highest existing code that matches the pattern for this store type
  let maxNumber = 0;

  for (const store of stores) {
    const match = store.store_code?.match(codePattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  const nextNumber = maxNumber + 1;
  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
}

export function StoreDialog({ open, onOpenChange, store }: StoreDialogProps) {
  const createMutation = useCreateStore();
  const updateMutation = useUpdateStore();
  const { data: existingStores } = useStores();
  const [generatedCode, setGeneratedCode] = useState("");


  const form = useForm<StoreFormData>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      store_code: "",
      store_name: "",
      store_type: "own_store",
      debtor_code: "",
      address: "",
      contact_person: "",
      phone: "",
      email: "",
      is_active: true,
    },
  });

  // Watch store_type to regenerate code when it changes
  const watchedStoreType = form.watch("store_type");

  // Reset form with store data when editing, or generate new code when creating
  useEffect(() => {
    if (store) {
      form.reset({
        store_code: store.store_code || "",
        store_name: store.store_name || "",
        store_type: (store.store_type as "own_store" | "franchisee") || "own_store",
        debtor_code: store.debtor_code || "",
        address: store.address || "",
        contact_person: store.contact_person || "",
        phone: store.phone || "",
        email: store.email || "",
        is_active: store.is_active ?? true,
      });
      setGeneratedCode("");
    } else if (open) {
      // Generate next store code for new stores based on store type
      const currentStoreType = form.getValues("store_type") || "own_store";
      const nextCode = generateNextStoreCode(existingStores, currentStoreType);
      setGeneratedCode(nextCode);
      form.setValue("store_code", nextCode);
      form.setValue("debtor_code", nextCode);
    }
  }, [store, form, existingStores, open]);

  // Regenerate code when store type changes (only for new stores)
  useEffect(() => {
    if (!store && open && watchedStoreType) {
      const nextCode = generateNextStoreCode(existingStores, watchedStoreType);
      setGeneratedCode(nextCode);
      form.setValue("store_code", nextCode);
      form.setValue("debtor_code", nextCode);
    }
  }, [watchedStoreType, store, open, existingStores, form]);

  const onSubmit = async (data: StoreFormData) => {
    try {
      if (store) {
        await updateMutation.mutateAsync({
          id: store.id,
          updates: data as Partial<Store>,
        });
      } else {
        await createMutation.mutateAsync(data as Omit<Store, 'id' | 'created_at' | 'updated_at'>);
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{store ? "Edit Store" : "Add New Store"}</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="store_code">Store Code *</Label>
              <Input
                id="store_code"
                {...form.register("store_code")}
                placeholder="e.g., STR-TLC-001 or FRC-TLC-001"
                disabled={!store} // Read-only for new stores (auto-generated)
                className={!store ? "bg-muted" : ""}
              />
              {form.formState.errors.store_code && (
                <p className="text-sm text-destructive">{form.formState.errors.store_code.message}</p>
              )}
              {!store && (
                <p className="text-xs text-muted-foreground">Auto-generated</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="debtor_code">Debtor Code *</Label>
              <Input
                id="debtor_code"
                {...form.register("debtor_code")}
                placeholder="Debtor code"
                disabled={!store} // Read-only for new stores (same as store_code)
                className={!store ? "bg-muted" : ""}
              />
              {form.formState.errors.debtor_code && (
                <p className="text-sm text-destructive">{form.formState.errors.debtor_code.message}</p>
              )}
              {!store && (
                <p className="text-xs text-muted-foreground">Same as Store Code</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="store_name">Store Name *</Label>
            <Input
              id="store_name"
              {...form.register("store_name")}
              placeholder="Full store name"
            />
            {form.formState.errors.store_name && (
              <p className="text-sm text-destructive">{form.formState.errors.store_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="store_type">Store Type *</Label>
            <Select
              value={form.watch("store_type")}
              onValueChange={(value) => form.setValue("store_type", value as "own_store" | "franchisee")}
            >
              <SelectTrigger id="store_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="own_store">Own Store</SelectItem>
                <SelectItem value="franchisee">Franchisee</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.store_type && (
              <p className="text-sm text-destructive">{form.formState.errors.store_type.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              {...form.register("address")}
              placeholder="Store address"
            />
            {form.formState.errors.address && (
              <p className="text-sm text-destructive">{form.formState.errors.address.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                {...form.register("contact_person")}
                placeholder="Contact name"
              />
              {form.formState.errors.contact_person && (
                <p className="text-sm text-destructive">{form.formState.errors.contact_person.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                {...form.register("phone")}
                placeholder="Contact phone"
              />
              {form.formState.errors.phone && (
                <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...form.register("email")}
              placeholder="contact@store.com"
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              {...form.register("is_active")}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Active Store
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {store ? "Update Store" : "Create Store"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
