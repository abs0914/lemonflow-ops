import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStores, getPOSDailySales } from "@/lib/salesApi/client";
import type { DateRange, SalesOrder } from "@/lib/salesApi/types";

export function useStoresData() {
  return useQuery({
    queryKey: ["sales-stores"],
    queryFn: () => getStores(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePOSSalesData(dateRange: DateRange, storeCode?: string) {
  return useQuery({
    queryKey: ["pos-sales", dateRange.from, dateRange.to, storeCode],
    queryFn: () =>
      getPOSDailySales({
        startDate: dateRange.from,
        endDate: dateRange.to,
        storeCode,
        limit: 500,
      }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Fetch sales orders from local Supabase database
export function useSalesOrdersData() {
  return useQuery({
    queryKey: ["sales-orders-local"],
    queryFn: async (): Promise<SalesOrder[]> => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select(`
          *,
          sales_order_lines (*)
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        console.error("Error fetching sales orders:", error);
        throw error;
      }

      // Transform to match SalesOrder type expected by dashboard
      return (data || []).map((order) => ({
        docNo: order.order_number,
        docDate: order.doc_date,
        debtorCode: order.debtor_code,
        totalAmount: order.total_amount || 0,
        isCancelled: order.status === "cancelled",
        lines: (order.sales_order_lines || []).map((line: any) => ({
          itemCode: line.item_code,
          description: line.item_name,
          quantity: line.quantity,
          unitPrice: line.unit_price || 0,
          subTotal: line.sub_total || 0,
        })),
      }));
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
