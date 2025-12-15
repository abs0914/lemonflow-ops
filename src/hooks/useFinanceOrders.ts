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

      // Sync to AutoCount first - handle both invoke errors and API errors gracefully
      let syncSuccess = false;
      let documentNo: string | null = null;
      let syncErrorMessage: string | null = null;

      try {
        const { data: syncData, error: syncError } = await supabase.functions.invoke(
          "sync-sales-order",
          { body: { salesOrderId: orderId } }
        );

        if (syncError) {
          console.error("AutoCount sync error:", syncError);
          syncErrorMessage = syncError.message || "AutoCount sync failed";
        } else if (syncData?.success) {
          syncSuccess = true;
          documentNo = syncData.documentNo || null;
        } else if (syncData?.error) {
          syncErrorMessage = syncData.error;
        }
      } catch (err) {
        console.error("AutoCount sync exception:", err);
        syncErrorMessage = err instanceof Error ? err.message : "AutoCount sync failed";
      }

      // Update order with payment confirmation and sync status
      const { error } = await supabase
        .from("sales_orders")
        .update({
          status: "processing",
          payment_amount: paymentAmount,
          payment_reference: paymentReference || null,
          payment_confirmed_by: user.id,
          payment_confirmed_at: new Date().toISOString(),
          autocount_synced: syncSuccess,
          autocount_doc_no: documentNo,
          synced_at: syncSuccess ? new Date().toISOString() : null,
          sync_error_message: syncErrorMessage,
        })
        .eq("id", orderId);

      if (error) throw error;

      return { syncSuccess, documentNo };
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
