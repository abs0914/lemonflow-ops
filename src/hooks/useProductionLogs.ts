import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductionLog {
  id: string;
  item_id: string;
  quantity: number;
  created_at: string;
  performed_by: string;
  notes: string | null;
  autocount_synced: boolean | null;
  autocount_doc_no: string | null;
  components?: {
    name: string;
    sku: string;
  };
  user_profiles?: {
    full_name: string;
  };
}

export function useProductionLogs() {
  return useQuery({
    queryKey: ["production-logs"],
    queryFn: async () => {
      const { data: movements, error } = await supabase
        .from("stock_movements")
        .select("*")
        .eq("movement_type", "assembly_produce")
        .eq("item_type", "component")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch components and products separately
      const itemIds = [...new Set(movements?.map(m => m.item_id) || [])];
      let itemMap = new Map<string, { id: string; name: string; sku: string }>();
      if (itemIds.length > 0) {
        const { data: components } = await supabase
          .from("components")
          .select("id, name, sku")
          .in("id", itemIds);
        for (const c of components || []) {
          itemMap.set(c.id, c);
        }

        // Fallback: check products table for any unmatched IDs
        const unmatchedIds = itemIds.filter(id => !itemMap.has(id));
        if (unmatchedIds.length > 0) {
          const { data: products } = await supabase
            .from("products")
            .select("id, name, sku")
            .in("id", unmatchedIds);
          for (const p of products || []) {
            itemMap.set(p.id, p);
          }
        }
      }

      // Fetch user profiles separately
      const userIds = [...new Set(movements?.map(m => m.performed_by) || [])];
      let profileMap = new Map<string, { id: string; full_name: string }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("id, full_name")
          .in("id", userIds);
        profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      }

      return movements?.map(movement => ({
        ...movement,
        components: itemMap.get(movement.item_id),
        user_profiles: profileMap.get(movement.performed_by),
      })) as ProductionLog[];
    },
  });
}
