import { useQuery } from "@tanstack/react-query";
import { getStores, getPOSDailySales, getSalesOrders } from "@/lib/salesApi/client";
import type { DateRange } from "@/lib/salesApi/types";

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

export function useSalesOrdersData() {
  return useQuery({
    queryKey: ["sales-orders"],
    queryFn: () => getSalesOrders(500),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
