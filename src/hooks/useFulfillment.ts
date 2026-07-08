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

export function useFulfillmentConsolidation(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ["fulfillment-consolidation", fromDate, toDate],
    queryFn: async () => {
      // Get orders in date range by delivery date
      const { data: rangeOrders, error: rangeError } = await supabase
        .from("sales_orders")
        .select("id, order_number, stores(store_name)")
        .gte("delivery_date", fromDate)
        .lte("delivery_date", toDate)
        .in("status", ["submitted", "processing", "completed", "issues"]);

      if (rangeError) throw rangeError;

      const orders = rangeOrders || [];

      if (orders.length === 0) return { orders: [], lines: [] };

      const orderIds = orders.map((o) => o.id);

      const { data: lines, error: linesError } = await supabase
        .from("sales_order_lines")
        .select("*")
        .in("sales_order_id", orderIds)
        .order("item_code", { ascending: true });

      if (linesError) throw linesError;
      return { orders: orders as any[], lines: lines || [] };
    },
    enabled: !!fromDate && !!toDate,
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
