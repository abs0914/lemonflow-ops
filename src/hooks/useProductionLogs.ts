import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductionLog {
  id: string;
  item_id: string;
  item_type: string;
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
        .in("item_type", ["component", "raw_material"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      const componentIds = [...new Set((movements || []).filter(m => m.item_type === "component").map(m => m.item_id))];
      const rawIds = [...new Set((movements || []).filter(m => m.item_type === "raw_material").map(m => m.item_id))];

      const itemMap = new Map<string, { id: string; name: string; sku: string }>();

      if (componentIds.length > 0) {
        const { data: components } = await supabase
          .from("components")
          .select("id, name, sku")
          .in("id", componentIds);
        for (const c of components || []) itemMap.set(c.id, c);

        // Fallback to products for any unmatched component ids
        const unmatched = componentIds.filter(id => !itemMap.has(id));
        if (unmatched.length > 0) {
          const { data: products } = await supabase
            .from("products")
            .select("id, name, sku")
            .in("id", unmatched);
          for (const p of products || []) itemMap.set(p.id, p);
        }
      }

      if (rawIds.length > 0) {
        const { data: raws } = await supabase
          .from("raw_materials")
          .select("id, name, sku")
          .in("id", rawIds);
        for (const r of raws || []) itemMap.set(r.id, r);
      }

      const userIds = [...new Set((movements || []).map(m => m.performed_by))];
      let profileMap = new Map<string, { id: string; full_name: string }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("id, full_name")
          .in("id", userIds);
        profileMap = new Map((profiles || []).map(p => [p.id, p]));
      }

      return (movements || []).map(movement => ({
        ...movement,
        components: itemMap.get(movement.item_id),
        user_profiles: profileMap.get(movement.performed_by),
      })) as ProductionLog[];
    },
  });
}
