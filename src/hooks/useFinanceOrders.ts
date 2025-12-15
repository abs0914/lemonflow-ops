import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SalesOrder } from "@/types/sales-order";

export function useFinanceOrders() {
  return useQuery({
    queryKey: ["finance-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select(`
          *,
          stores (*)
        `)
        .eq("status", "pending_payment")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SalesOrder[];
    },
  });
}

export function useConfirmPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      paymentAmount,
      paymentReference,
    }: {
      orderId: string;
      paymentAmount: number;
      paymentReference?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("sales_orders")
        .update({
          status: "processing",
          payment_amount: paymentAmount,
          payment_reference: paymentReference || null,
          payment_confirmed_by: user.id,
          payment_confirmed_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-orders"] });
      queryClient.invalidateQueries({ queryKey: ["fulfillment-orders"] });
      queryClient.invalidateQueries({ queryKey: ["sales-order"] });
    },
  });
}

export function useRejectPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      reason,
    }: {
      orderId: string;
      reason: string;
    }) => {
      // First release the reserved stock
      const { error: releaseError } = await supabase.rpc(
        "release_sales_order_stock",
        { p_sales_order_id: orderId }
      );

      if (releaseError) throw releaseError;

      // Then update the order status
      const { error } = await supabase
        .from("sales_orders")
        .update({
          status: "cancelled",
          cancellation_reason: reason,
        })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-orders"] });
      queryClient.invalidateQueries({ queryKey: ["fulfillment-orders"] });
      queryClient.invalidateQueries({ queryKey: ["sales-order"] });
    },
  });
}
