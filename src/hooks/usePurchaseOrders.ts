import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PurchaseOrder, PurchaseOrderLine } from "@/types/inventory";

export function usePurchaseOrders(status?: string) {
  return useQuery({
    queryKey: ["purchase-orders", status],
    queryFn: async () => {
      let query = supabase
        .from("purchase_orders")
        .select(`
          *,
          suppliers(supplier_code, company_name)
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
      })) as any;
    },
  });
}

export function usePurchaseOrder(id?: string) {
  return useQuery({
    queryKey: ["purchase-order", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          suppliers(supplier_code, company_name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      // Fetch user profile
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .eq("id", data.created_by)
        .single();

      return {
        ...data,
        user_profiles: profile,
      } as any;
    },
    enabled: !!id,
  });
}

export function usePurchaseOrderLines(purchaseOrderId?: string) {
  return useQuery({
    queryKey: ["purchase-order-lines", purchaseOrderId],
    queryFn: async () => {
      if (!purchaseOrderId) return [];
      
      const { data, error } = await supabase
        .from("purchase_order_lines")
        .select(`
          *,
          components(id, sku, name, unit)
        `)
        .eq("purchase_order_id", purchaseOrderId)
        .order("line_number", { ascending: true });

      if (error) throw error;
      return data as PurchaseOrderLine[];
    },
    enabled: !!purchaseOrderId,
  });
}
