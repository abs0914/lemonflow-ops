import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StockMovement {
  id: string;
  movement_type: string;
  item_type: string;
  item_id: string;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  performed_by: string;
  created_at: string;
  user_profiles?: {
    full_name: string;
  };
}

export function useStockMovements(itemType?: string, itemId?: string) {
  return useQuery({
    queryKey: ["stock-movements", itemType, itemId],
    queryFn: async () => {
      let query = supabase
        .from("stock_movements")
        .select("*")
        .order("created_at", { ascending: false });

      if (itemType) {
        query = query.eq("item_type", itemType);
      }

      if (itemId) {
        query = query.eq("item_id", itemId);
      }

      const { data: movements, error } = await query;

      if (error) throw error;

      // Fetch user profiles separately
      const userIds = [...new Set(movements?.map(m => m.performed_by) || [])];
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return movements?.map(movement => ({
        ...movement,
        user_profiles: profileMap.get(movement.performed_by),
      })) as StockMovement[];
    },
  });
}
