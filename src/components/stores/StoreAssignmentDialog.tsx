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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreateStoreAssignment, useUpdateStoreAssignment } from "@/hooks/useStoreAssignments";
import { useStores } from "@/hooks/useStores";
import { Session } from "@supabase/supabase-js";

const assignmentSchema = z.object({
  user_id: z.string().uuid("Invalid user selected"),
  store_id: z.string().uuid("Invalid store selected"),
  is_primary: z.boolean().default(false),
  can_place_orders: z.boolean().default(true),
});

type AssignmentFormData = z.infer<typeof assignmentSchema>;

interface StoreAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment?: any;
}

export function StoreAssignmentDialog({ open, onOpenChange, assignment }: StoreAssignmentDialogProps) {
  const [session, setSession] = useState<Session | null>(null);
  const createMutation = useCreateStoreAssignment();
  const updateMutation = useUpdateStoreAssignment();
  const { data: stores } = useStores();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const { data: users } = useQuery({
    queryKey: ["users-for-assignment", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .order("full_name", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user,
  });

  const form = useForm<AssignmentFormData>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      user_id: "",
      store_id: "",
      is_primary: false,
      can_place_orders: true,
    },
  });

  // Reset form when assignment changes or dialog opens
  useEffect(() => {
    if (open) {
      if (assignment) {
        form.reset({
          user_id: assignment.user_id || "",
          store_id: assignment.store_id || "",
          is_primary: assignment.is_primary ?? false,
          can_place_orders: assignment.can_place_orders ?? true,
        });
      } else {
        form.reset({
          user_id: "",
          store_id: "",
          is_primary: false,
          can_place_orders: true,
        });
      }
    }
  }, [assignment, open, form]);

  const onSubmit = async (data: AssignmentFormData) => {
    try {
      if (assignment) {
        await updateMutation.mutateAsync({
          id: assignment.id,
          updates: {
            is_primary: data.is_primary,
            can_place_orders: data.can_place_orders,
          },
        });
      } else {
        await createMutation.mutateAsync({
          user_id: data.user_id,
          store_id: data.store_id,
          is_primary: data.is_primary,
          can_place_orders: data.can_place_orders,
        });
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{assignment ? "Edit Assignment" : "Assign User to Store"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user_id">User *</Label>
            <Select
              value={form.watch("user_id")}
              onValueChange={(value) => form.setValue("user_id", value)}
              disabled={!!assignment}
            >
              <SelectTrigger id="user_id">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.user_id && (
              <p className="text-sm text-destructive">{form.formState.errors.user_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="store_id">Store *</Label>
            <Select
              value={form.watch("store_id")}
              onValueChange={(value) => form.setValue("store_id", value)}
              disabled={!!assignment}
            >
              <SelectTrigger id="store_id">
                <SelectValue placeholder="Select a store" />
              </SelectTrigger>
              <SelectContent>
                {stores?.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.store_name} ({store.store_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.store_id && (
              <p className="text-sm text-destructive">{form.formState.errors.store_id.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_primary"
                {...form.register("is_primary")}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="is_primary" className="cursor-pointer">
                Primary Store (Default selection for this user)
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="can_place_orders"
                {...form.register("can_place_orders")}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="can_place_orders" className="cursor-pointer">
                Can Place Orders
              </Label>
            </div>
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
              {assignment ? "Update Assignment" : "Create Assignment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}