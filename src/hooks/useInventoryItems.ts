import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  unit: string;
  price?: number;
  stock_quantity: number;
  autocount_item_code?: string;
}

export function useInventoryItems() {
  return useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("components")
        .select("*")
        .eq("stock_control", true)
        .gt("stock_quantity", 0)
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data as InventoryItem[];
    },
  });
}
