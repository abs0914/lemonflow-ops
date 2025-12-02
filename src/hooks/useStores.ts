import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Store } from "@/types/sales-order";
import { toast } from "sonner";

export function useStores() {
  return useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("store_name", { ascending: true });
      
      if (error) throw error;
      return data as Store[];
    },
  });
}

export function useStore(id?: string) {
  return useQuery({
    queryKey: ["stores", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data as Store;
    },
    enabled: !!id,
  });
}

export function useCreateStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storeData: Omit<Store, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from("stores")
        .insert(storeData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      toast.success("Store created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create store: ${error.message}`);
    },
  });
}

export function useUpdateStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Store> }) => {
      const { data, error } = await supabase
        .from("stores")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      toast.success("Store updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update store: ${error.message}`);
    },
  });
}

export function useDeleteStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("stores")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      toast.success("Store deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete store: ${error.message}`);
    },
  });
}
