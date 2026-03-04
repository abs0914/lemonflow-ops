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
        .in("status", ["pending_payment", "awaiting_proof"])
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
      deliveryFee,
      shippingFee,
      expediteFee,
      fulfillmentType,
      vatAmount,
      ewtAmount,
      underpayment,
      overpayment,
      discountAmount,
    }: {
      orderId: string;
      paymentAmount: number;
      paymentReference?: string;
      deliveryFee?: number;
      shippingFee?: number;
      expediteFee?: number;
      fulfillmentType?: string;
      vatAmount?: number;
      ewtAmount?: number;
      underpayment?: number;
      overpayment?: number;
      discountAmount?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Update order with fees and send to franchisee for proof of payment
      const { error } = await supabase
        .from("sales_orders")
        .update({
          status: "awaiting_proof",
          payment_amount: paymentAmount,
          payment_reference: paymentReference || null,
          payment_confirmed_by: user.id,
          payment_confirmed_at: new Date().toISOString(),
          delivery_fee: deliveryFee ?? 0,
          shipping_fee: shippingFee ?? 0,
          expedite_fee: expediteFee ?? 0,
          delivery_notes: fulfillmentType || null,
          vat_amount: vatAmount ?? 0,
          ewt_amount: ewtAmount ?? 0,
          underpayment: underpayment ?? 0,
          overpayment: overpayment ?? 0,
          discount_amount: discountAmount ?? 0,
        } as any)
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-orders"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-orders"] });
      queryClient.invalidateQueries({ queryKey: ["fulfillment-orders"] });
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
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
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
    },
  });
}

export function useValidateProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, deliveryDate, fulfillmentType }: { orderId: string; deliveryDate: string; fulfillmentType?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("sales_orders")
        .update({
          status: "pending_accounting",
          delivery_date: deliveryDate,
          ...(fulfillmentType ? { delivery_notes: fulfillmentType } : {}),
        } as any)
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-orders"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-orders"] });
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
    },
  });
}
