import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { dateFormatters } from "@/lib/datetime";

// AutoCount Sync Dashboard - Monitor and manage synchronization operations
export default function AutoCountSyncDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: syncLogs, isLoading } = useQuery({
    queryKey: ["autocount-sync-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("autocount_sync_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  const { data: syncStats } = useQuery({
    queryKey: ["autocount-sync-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("autocount_sync_log")
        .select("sync_status");

      if (error) throw error;

      const stats = {
        total: data.length,
        success: data.filter((log) => log.sync_status === "success").length,
        failed: data.filter((log) => log.sync_status === "failed").length,
        pending: data.filter((log) => log.sync_status === "pending").length,
        partial: data.filter((log) => log.sync_status === "partial").length,
      };

      return stats;
    },
  });

  const retrySync = useMutation({
    mutationFn: async (log: any) => {
      const syncTypeToFunctionMap: Record<string, string> = {
        po_create: "sync-po-create",
        po_cancel: "sync-po-cancel",
        grn: "sync-grn-to-autocount",
        goods_return: "sync-goods-return",
        stock_adjustment: "sync-stock-adjustment",
        stock_assembly: "sync-assembly-complete",
        cash_purchase_po: "sync-cash-purchase",
        pull: log.reference_type === "supplier" ? "sync-suppliers-execute" : "sync-inventory-execute",
      };

      const functionName = syncTypeToFunctionMap[log.sync_type];
      if (!functionName) {
        throw new Error(`Unknown sync type: ${log.sync_type}`);
      }

      // Update retry count
      const newRetryCount = (log.retry_count || 0) + 1;
      await supabase
        .from("autocount_sync_log")
        .update({ retry_count: newRetryCount })
        .eq("id", log.id);

      // Retry the sync by calling the appropriate edge function
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { referenceId: log.reference_id },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Sync Retried",
        description: "The sync operation has been retried successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["autocount-sync-logs"] });
      queryClient.invalidateQueries({ queryKey: ["autocount-sync-stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Retry Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge className="bg-success/10 text-success hover:bg-success/20">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Success
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-warning/10 text-warning hover:bg-warning/20">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case "partial":
        return (
          <Badge className="bg-accent/10 text-accent-foreground hover:bg-accent/20">
            <AlertCircle className="mr-1 h-3 w-3" />
            Partial
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AutoCount Sync Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage AutoCount synchronization operations
          </p>
        </div>
        <Button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["autocount-sync-logs"] });
            queryClient.invalidateQueries({ queryKey: ["autocount-sync-stats"] });
          }}
          variant="outline"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Total Syncs</div>
          <div className="text-3xl font-bold mt-2">{syncStats?.total || 0}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-success">Successful</div>
          <div className="text-3xl font-bold mt-2 text-success">{syncStats?.success || 0}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-destructive">Failed</div>
          <div className="text-3xl font-bold mt-2 text-destructive">{syncStats?.failed || 0}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-warning">Pending</div>
          <div className="text-3xl font-bold mt-2 text-warning">{syncStats?.pending || 0}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-accent-foreground">Partial</div>
          <div className="text-3xl font-bold mt-2 text-accent-foreground">{syncStats?.partial || 0}</div>
        </Card>
      </div>

      {/* Sync Logs Table */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Sync Operations</h2>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sync Type</TableHead>
                  <TableHead>Reference Type</TableHead>
                  <TableHead>Reference ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>AutoCount Doc No</TableHead>
                  <TableHead>Retry Count</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Error Message</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Loading sync logs...
                    </TableCell>
                  </TableRow>
                ) : syncLogs && syncLogs.length > 0 ? (
                  syncLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.sync_type}</TableCell>
                      <TableCell>{log.reference_type}</TableCell>
                      <TableCell className="font-mono text-sm">{log.reference_id.substring(0, 8)}...</TableCell>
                      <TableCell>{getSyncStatusBadge(log.sync_status)}</TableCell>
                      <TableCell>{log.autocount_doc_no || "-"}</TableCell>
                      <TableCell>{log.retry_count || 0}</TableCell>
                      <TableCell>{dateFormatters.dateTime(log.created_at)}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {log.error_message || "-"}
                      </TableCell>
                      <TableCell>
                        {log.sync_status === "failed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => retrySync.mutate(log)}
                            disabled={retrySync.isPending}
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Retry
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No sync logs found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>
    </div>
  );
}
