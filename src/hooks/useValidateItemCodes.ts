import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ComponentItem {
  sku: string;
  name: string;
  price: number | null;
}

export function useValidateItemCodes(itemCodes: string[]) {
  return useQuery({
    queryKey: ["validate-item-codes", itemCodes],
    queryFn: async () => {
      if (itemCodes.length === 0) {
        return { validCodes: new Set<string>(), itemDetails: new Map<string, ComponentItem>() };
      }

      // Query components table for matching SKUs
      const { data, error } = await supabase
        .from("components")
        .select("sku, name, price")
        .in("sku", itemCodes);

      if (error) throw error;

      const validCodes = new Set<string>(data?.map(item => item.sku) || []);
      const itemDetails = new Map<string, ComponentItem>(
        data?.map(item => [item.sku, item]) || []
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
