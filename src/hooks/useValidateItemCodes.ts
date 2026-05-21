import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ComponentItem {
  sku: string;
  name: string;
  price: number | null;
  unit: string;
  stock_quantity?: number;
  reserved_quantity?: number;
  available_quantity?: number;
}

export function useValidateItemCodes(itemCodes: string[]) {
  return useQuery({
    queryKey: ["validate-item-codes", itemCodes],
    queryFn: async () => {
      if (itemCodes.length === 0) {
        return { validCodes: new Set<string>(), itemDetails: new Map<string, ComponentItem>() };
      }

      const { data, error } = await supabase
        .from("components")
        .select("sku, name, price, unit, stock_quantity, reserved_quantity")
        .in("sku", itemCodes);

      if (error) throw error;

      const validCodes = new Set<string>(data?.map(item => item.sku) || []);
      const itemDetails = new Map<string, ComponentItem>(
        (data || []).map((item: any) => [
          item.sku,
          {
            ...item,
            stock_quantity: Number(item.stock_quantity || 0),
            reserved_quantity: Number(item.reserved_quantity || 0),
            available_quantity: Number(item.stock_quantity || 0) - Number(item.reserved_quantity || 0),
          },
        ])
      );

      return { validCodes, itemDetails };
    },
    enabled: itemCodes.length > 0,
    staleTime: 60 * 1000,
  });
}

export function useComponentByCode(itemCode: string) {
  return useQuery({
    queryKey: ["component-by-code", itemCode],
    queryFn: async () => {
      if (!itemCode) return null;

      const { data, error } = await supabase
        .from("components")
        .select("*")
        .eq("sku", itemCode)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!itemCode,
  });
}
