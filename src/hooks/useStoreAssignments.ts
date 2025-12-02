import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StoreAssignment {
  id: string;
  user_id: string;
  store_id: string;
  is_primary: boolean;
  can_place_orders: boolean;
  created_at: string;
  user_profiles?: { full_name: string; role: string };
  stores?: { store_name: string; store_code: string };
}

export function useStoreAssignments() {
  return useQuery({
    queryKey: ["store-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_store_assignments")
        .select(`
          *,
          user_profiles(full_name, role),
          stores(store_name, store_code)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useUserAssignments(userId?: string) {
  return useQuery({
    queryKey: ["store-assignments", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("user_store_assignments")
        .select(`
          *,
          stores(store_name, store_code)
        `)
        .eq("user_id", userId);
      
      if (error) throw error;
      return data as any[];
    },
    enabled: !!userId,
  });
}

export function useCreateStoreAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentData: {
      user_id: string;
      store_id: string;
      is_primary?: boolean;
      can_place_orders?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("user_store_assignments")
        .insert(assignmentData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-assignments"] });
      toast.success("Store assignment created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create assignment: ${error.message}`);
    },
  });
}

export function useUpdateStoreAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<StoreAssignment> }) => {
      const { data, error } = await supabase
        .from("user_store_assignments")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-assignments"] });
      toast.success("Assignment updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update assignment: ${error.message}`);
    },
  });
}

export function useDeleteStoreAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_store_assignments")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-assignments"] });
      toast.success("Assignment deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete assignment: ${error.message}`);
    },
  });
}
