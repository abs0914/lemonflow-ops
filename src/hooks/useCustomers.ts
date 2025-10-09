import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Customer } from "@/types/inventory";

export function useCustomers(isActive?: boolean) {
  return useQuery({
    queryKey: ["customers", isActive],
    queryFn: async () => {
      let query = supabase
        .from("customers")
        .select("*")
        .order("company_name", { ascending: true });

      if (isActive !== undefined) {
        query = query.eq("is_active", isActive);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Customer[];
    },
  });
}

export function useCustomer(id?: string) {
  return useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Customer;
    },
    enabled: !!id,
  });
}
