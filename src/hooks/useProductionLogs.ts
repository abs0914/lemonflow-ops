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

      // Fetch components separately
      const componentIds = [...new Set(movements?.map(m => m.item_id) || [])];
      const { data: components } = await supabase
        .from("components")
        .select("id, name, sku")
        .in("id", componentIds);

      const componentMap = new Map(components?.map(c => [c.id, c]) || []);

      // Fetch user profiles separately
      const userIds = [...new Set(movements?.map(m => m.performed_by) || [])];
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return movements?.map(movement => ({
        ...movement,
        components: componentMap.get(movement.item_id),
        user_profiles: profileMap.get(movement.performed_by),
      })) as ProductionLog[];
    },
  });
}
