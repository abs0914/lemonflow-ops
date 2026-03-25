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
      // Get orders in date range by order date (doc_date)
      const { data: rangeOrders, error: rangeError } = await supabase
        .from("sales_orders")
        .select("id, order_number, stores(store_name)")
        .gte("doc_date", fromDate)
        .lte("doc_date", toDate)
        .in("status", ["submitted", "processing"]);

      if (rangeError) throw rangeError;

      // Also get ALL processing orders to ensure none are missed
      const { data: processingOrders, error: procError } = await supabase
        .from("sales_orders")
        .select("id, order_number, stores(store_name)")
        .eq("status", "processing");

      if (procError) throw procError;

      // Merge and deduplicate
      const orderMap = new Map<string, any>();
      for (const o of [...(rangeOrders || []), ...(processingOrders || [])]) {
        orderMap.set(o.id, o);
      }
      const orders = Array.from(orderMap.values());

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
