import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Supplier } from "@/types/inventory";

export function useSuppliers(isActive?: boolean) {
  return useQuery({
    queryKey: ["suppliers", isActive],
    queryFn: async () => {
      let query = supabase
        .from("suppliers")
        .select("*")
        .order("company_name", { ascending: true });

      if (isActive !== undefined) {
        query = query.eq("is_active", isActive);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Supplier[];
    },
  });
}

export function useSupplier(id?: string) {
  return useQuery({
    queryKey: ["supplier", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Supplier;
    },
    enabled: !!id,
  });
}
