import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";

export function AutoSyncStatusIndicator() {
  // Last sync log entry
  const { data: lastSync } = useQuery({
    queryKey: ["auto-sync-last"],
    queryFn: async () => {
      const { data } = await supabase
        .from("autocount_sync_log")
        .select("sync_status, synced_at, created_at")
        .eq("sync_type", "auto_create")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    refetchInterval: 60_000,
  });

  // Counts from last 24h
  const { data: stats } = useQuery({
    queryKey: ["auto-sync-stats"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("autocount_sync_log")
        .select("sync_status")
        .eq("sync_type", "auto_create")
        .gte("created_at", since);

      const success = data?.filter((r) => r.sync_status === "success").length ?? 0;
      const failed = data?.filter((r) => r.sync_status === "failed").length ?? 0;
      return { success, failed };
    },
    refetchInterval: 60_000,
  });

  // Pending unsynced counts
  const { data: pending } = useQuery({
    queryKey: ["auto-sync-pending"],
    queryFn: async () => {
      const [orders, stores, suppliers] = await Promise.all([
        supabase
          .from("sales_orders")
          .select("id", { count: "exact", head: true })
          .eq("autocount_synced", false)
          .in("status", ["submitted"]),
        supabase
          .from("stores")
          .select("id", { count: "exact", head: true })
          .eq("autocount_synced", false)
          .eq("is_active", true),
        supabase
          .from("suppliers")
          .select("id", { count: "exact", head: true })
          .eq("autocount_synced", false)
          .eq("is_active", true),
      ]);
      return (orders.count ?? 0) + (stores.count ?? 0) + (suppliers.count ?? 0);
    },
    refetchInterval: 60_000,
  });

  const lastSyncTime = lastSync?.synced_at || lastSync?.created_at;
  const timeAgo = lastSyncTime
    ? formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })
    : "Never";

  const hasFailures = (stats?.failed ?? 0) > 0;
  const hasPending = (pending ?? 0) > 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-sidebar-accent/30 text-xs text-sidebar-foreground/80 cursor-default">
          <RefreshCw className="h-3.5 w-3.5 shrink-0" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-medium truncate">Auto-Sync</span>
            <span className="text-sidebar-foreground/60 truncate">{timeAgo}</span>
          </div>
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {hasPending && (
              <span className="flex items-center gap-0.5 text-amber-500">
                <Clock className="h-3 w-3" />
                {pending}
              </span>
            )}
            {hasFailures ? (
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            ) : (
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        <div className="space-y-1">
          <p className="font-medium">AutoCount Auto-Sync (5 min)</p>
          <p>Last sync: {timeAgo}</p>
          <p className="text-green-500">✓ {stats?.success ?? 0} synced (24h)</p>
          {hasFailures && (
            <p className="text-destructive">✗ {stats?.failed} failed (24h)</p>
          )}
          {hasPending && (
            <p className="text-amber-500">⏳ {pending} pending</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
