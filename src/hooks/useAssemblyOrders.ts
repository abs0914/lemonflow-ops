import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AssemblyOrder {
  id: string;
  product_id: string;
  quantity: number;
  status: string;
  created_by: string;
  created_at: string;
  due_date: string | null;
  notes: string | null;
  updated_at: string;
  stock_reserved: boolean | null;
  reservation_notes: string | null;
  products?: {
    name: string;
    sku: string;
  };
  user_profiles?: {
    full_name: string;
  };
}

export function useAssemblyOrders(status?: string) {
  return useQuery({
    queryKey: ["assembly-orders", status],
    queryFn: async () => {
      let query = supabase
        .from("assembly_orders")
        .select(`
          *,
          products(name, sku)
        `)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data: orders, error } = await query;

      if (error) throw error;

      // Fetch user profiles separately
      const userIds = [...new Set(orders?.map(o => o.created_by) || [])];
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return orders?.map(order => ({
        ...order,
        user_profiles: profileMap.get(order.created_by),
      })) as AssemblyOrder[];
    },
  });
}
