import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useFulfillmentOrders() {
  return useQuery({
    queryKey: ["fulfillment-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select(`
          *,
          stores(*)
        `)
        .in("status", ["submitted", "processing", "completed", "cancelled"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as any[];
    },
  });
}

export function useFulfillmentOrdersByIds(orderIds: string[]) {
  return useQuery({
    queryKey: ["fulfillment-orders-by-ids", orderIds],
    queryFn: async () => {
      if (orderIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("sales_orders")
        .select(`
          *,
          stores(*)
        `)
        .in("id", orderIds);

      if (error) throw error;
      return data as any[];
    },
    enabled: orderIds.length > 0,
  });
}

export function useFulfillmentOrderLines(orderIds: string[]) {
  return useQuery({
    queryKey: ["fulfillment-order-lines", orderIds],
    queryFn: async () => {
      if (orderIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("sales_order_lines")
        .select("*")
        .in("sales_order_id", orderIds)
        .order("line_number", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: orderIds.length > 0,
  });
}
