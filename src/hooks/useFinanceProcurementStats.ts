import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, subMonths, format, endOfMonth } from "date-fns";

export interface ProcurementStats {
  approvedPOs: number;
  pendingReceipt: number;
  goodsReceived: number;
  totalApprovedValue: number;
  pendingReceiptValue: number;
  monthlySpend: MonthlySpend[];
}

export interface MonthlySpend {
  month: string;
  monthLabel: string;
  totalAmount: number;
  poCount: number;
}

export function useFinanceProcurementStats() {
  return useQuery({
    queryKey: ["finance-procurement-stats"],
    queryFn: async () => {
      // Fetch approved purchase orders
      const { data: approvedPOs, error: poError } = await supabase
        .from("purchase_orders")
        .select("id, total_amount, goods_received, doc_date, status")
        .eq("status", "approved");

      if (poError) throw poError;

      // Calculate stats
      const pendingReceipt = approvedPOs?.filter(po => !po.goods_received) || [];
      const received = approvedPOs?.filter(po => po.goods_received) || [];

      // Calculate monthly spend for last 6 months
      const now = new Date();
      const months: MonthlySpend[] = [];

      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(now, i));
        const monthEnd = endOfMonth(subMonths(now, i));
        const monthKey = format(monthStart, "yyyy-MM");
        const monthLabel = format(monthStart, "MMM");

        const monthPOs = approvedPOs?.filter(po => {
          const poDate = new Date(po.doc_date);
          return poDate >= monthStart && poDate <= monthEnd;
        }) || [];

        months.push({
          month: monthKey,
          monthLabel,
          totalAmount: monthPOs.reduce((sum, po) => sum + (po.total_amount || 0), 0),
          poCount: monthPOs.length,
        });
      }

      return {
        approvedPOs: approvedPOs?.length || 0,
        pendingReceipt: pendingReceipt.length,
        goodsReceived: received.length,
        totalApprovedValue: approvedPOs?.reduce((sum, po) => sum + (po.total_amount || 0), 0) || 0,
        pendingReceiptValue: pendingReceipt.reduce((sum, po) => sum + (po.total_amount || 0), 0),
        monthlySpend: months,
      } as ProcurementStats;
    },
  });
}

export function usePendingReceiptPOs() {
  return useQuery({
    queryKey: ["pending-receipt-pos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          id,
          po_number,
          total_amount,
          doc_date,
          delivery_date,
          suppliers(supplier_code, company_name)
        `)
        .eq("status", "approved")
        .eq("goods_received", false)
        .order("delivery_date", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}
