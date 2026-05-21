import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AssemblyOrder {
  id: string;
  product_id: string | null;
  raw_material_id: string | null;
  quantity: number;
  status: string;
  created_by: string;
  created_at: string;
  due_date: string | null;
  notes: string | null;
  updated_at: string;
  stock_reserved: boolean | null;
  reservation_notes: string | null;
  products?: { name: string; sku: string } | null;
  raw_materials?: { name: string; sku: string } | null;
  user_profiles?: { full_name: string };
}

export function useAssemblyOrders(status?: string) {
  return useQuery({
    queryKey: ["assembly-orders", status],
    queryFn: async () => {
      let query = supabase
        .from("assembly_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (status) query = query.eq("status", status);

      const { data: orders, error } = await query;
      if (error) throw error;

      const productIds = [...new Set((orders || []).map(o => o.product_id).filter(Boolean) as string[])];
      const rawIds = [...new Set((orders || []).map(o => o.raw_material_id).filter(Boolean) as string[])];
      const userIds = [...new Set((orders || []).map(o => o.created_by))];

      const [productsRes, rawsRes, profilesRes] = await Promise.all([
        productIds.length
          ? supabase.from("products").select("id, name, sku").in("id", productIds)
          : Promise.resolve({ data: [] as any[] }),
        rawIds.length
          ? supabase.from("raw_materials").select("id, name, sku").in("id", rawIds)
          : Promise.resolve({ data: [] as any[] }),
        userIds.length
          ? supabase.from("user_profiles").select("id, full_name").in("id", userIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const productMap = new Map((productsRes.data || []).map((p: any) => [p.id, { name: p.name, sku: p.sku }]));
      const rawMap = new Map((rawsRes.data || []).map((r: any) => [r.id, { name: r.name, sku: r.sku }]));
      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, { full_name: p.full_name }]));

      return (orders || []).map(o => ({
        ...o,
        products: o.product_id ? productMap.get(o.product_id) || null : null,
        raw_materials: o.raw_material_id ? rawMap.get(o.raw_material_id) || null : null,
        user_profiles: profileMap.get(o.created_by),
      })) as AssemblyOrder[];
    },
  });
}
