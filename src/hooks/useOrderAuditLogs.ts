import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useOrderAuditLogs(orderId?: string) {
  return useQuery({
    queryKey: ["order-audit-logs", orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("entity_type", "sales_order")
        .eq("entity_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = Array.from(new Set((data || []).map((l: any) => l.user_id).filter(Boolean)));
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("id, full_name")
          .in("id", userIds);
        profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.full_name]));
      }
      return (data || []).map((l: any) => ({ ...l, user_name: profileMap[l.user_id] || "Unknown" }));
    },
    enabled: !!orderId,
  });
}
