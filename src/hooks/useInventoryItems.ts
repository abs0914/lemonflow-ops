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
  reserved_quantity: number;
  available_quantity: number;
  autocount_item_code?: string;
}

export function useInventoryItems() {
  return useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("components")
        .select("id, sku, name, description, unit, price, stock_quantity, reserved_quantity, autocount_item_code")
        .eq("stock_control", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        reserved_quantity: Number(item.reserved_quantity || 0),
        stock_quantity: Number(item.stock_quantity || 0),
        available_quantity:
          Number(item.stock_quantity || 0) - Number(item.reserved_quantity || 0),
      })) as InventoryItem[];
    },
  });
}

/** Find available qty for an item code (matches autocount_item_code or sku). */
export function getAvailableForCode(
  itemCode: string,
  items: InventoryItem[] | undefined
): number | null {
  if (!items) return null;
  const row = items.find(
    (i) => i.autocount_item_code === itemCode || i.sku === itemCode
  );
  if (!row) return null;
  return row.available_quantity;
}
