import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SalesOrder } from "@/types/sales-order";

export function useAccountingOrders() {
  return useQuery({
    queryKey: ["accounting-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select(`
          *,
          stores (*)
        `)
        .eq("status", "pending_accounting")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SalesOrder[];
    },
  });
}

export function useAccountingApprove() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      notes,
    }: {
      orderId: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("sales_orders")
        .update({
          status: "processing",
          delivery_notes: notes ? 
            `${notes}` : undefined,
        } as any)
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-orders"] });
      queryClient.invalidateQueries({ queryKey: ["fulfillment-orders"] });
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
    },
  });
}

export function useAccountingNotePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      notes,
    }: {
      orderId: string;
      notes: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Add accounting notes but keep in pending_accounting status
      const { error } = await supabase
        .from("sales_orders")
        .update({
          delivery_notes: notes,
        } as any)
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-orders"] });
    },
  });
}
