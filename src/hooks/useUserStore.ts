import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { UserStoreAssignment } from "@/types/sales-order";

export function useUserStores() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["user-stores", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("user_store_assignments")
        .select(`
          *,
          stores(*)
        `)
        .eq("user_id", user.id)
        .eq("can_place_orders", true)
        .order("is_primary", { ascending: false });
      
      if (error) throw error;
      return data as UserStoreAssignment[];
    },
    enabled: !!user?.id,
  });
}

export function usePrimaryStore() {
  const { data: stores } = useUserStores();
  return stores?.find(s => s.is_primary) || stores?.[0];
}
