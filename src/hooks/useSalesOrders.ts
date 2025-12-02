import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SalesOrder, SalesOrderLine } from "@/types/sales-order";
import { toast } from "sonner";

export function useSalesOrders(storeId?: string) {
  return useQuery({
    queryKey: ["sales-orders", storeId],
    queryFn: async () => {
      let query = supabase
        .from("sales_orders")
        .select(`
          *,
          stores(*),
          created_by_profile:user_profiles!created_by(full_name)
        `)
        .order("created_at", { ascending: false });
      
      if (storeId) {
        query = query.eq("store_id", storeId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useSalesOrder(id?: string) {
  return useQuery({
    queryKey: ["sales-orders", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("sales_orders")
        .select(`
          *,
          stores(*),
          created_by_profile:user_profiles!created_by(full_name)
        `)
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });
}

export function useSalesOrderLines(orderId?: string) {
  return useQuery({
    queryKey: ["sales-order-lines", orderId],
    queryFn: async () => {
      if (!orderId) return [];
      
      const { data, error } = await supabase
        .from("sales_order_lines")
        .select("*")
        .eq("sales_order_id", orderId)
        .order("line_number", { ascending: true });
      
      if (error) throw error;
      return data as SalesOrderLine[];
    },
    enabled: !!orderId,
  });
}

export function useCreateSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderData: {
      store_id: string;
      debtor_code: string;
      doc_date: string;
      delivery_date?: string;
      description?: string;
      lines: Omit<SalesOrderLine, 'id' | 'sales_order_id' | 'created_at' | 'updated_at'>[];
    }) => {
      // Generate order number
      const { data: orderNumber, error: fnError } = await supabase.rpc("generate_sales_order_number");
      if (fnError) throw fnError;

      // Calculate total
      const total = orderData.lines.reduce((sum, line) => sum + line.sub_total, 0);

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("sales_orders")
        .insert({
          order_number: orderNumber,
          store_id: orderData.store_id,
          debtor_code: orderData.debtor_code,
          doc_date: orderData.doc_date,
          delivery_date: orderData.delivery_date,
          description: orderData.description,
          total_amount: total,
          status: "draft",
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order lines
      const lines = orderData.lines.map((line, index) => ({
        ...line,
        sales_order_id: order.id,
        line_number: index + 1,
      }));

      const { error: linesError } = await supabase
        .from("sales_order_lines")
        .insert(lines);

      if (linesError) throw linesError;

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      toast.success("Sales order created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create order: ${error.message}`);
    },
  });
}

export function useUpdateSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SalesOrder> }) => {
      const { data, error } = await supabase
        .from("sales_orders")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      toast.success("Order updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update order: ${error.message}`);
    },
  });
}

export function useDeleteSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sales_orders")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      toast.success("Order deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete order: ${error.message}`);
    },
  });
}
