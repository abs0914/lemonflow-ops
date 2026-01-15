import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";

interface SyncLog {
  id: string;
  reference_id: string;
  reference_type: string;
  sync_type: string;
  sync_status: string;
  autocount_doc_no: string | null;
  error_message: string | null;
  retry_count: number | null;
  synced_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export default function SyncMonitor() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");

  // Check if user has permission (Admin only)
  if (user && profile && profile.role !== "Admin") {
    navigate("/");
    return null;
  }

  const { data: syncLogs, isLoading } = useQuery({
    queryKey: ["sync-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("autocount_sync_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      return data as SyncLog[];
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (syncLogId: string) => {
      const { data, error } = await supabase.functions.invoke("retry-failed-sync", {
        body: { sync_log_id: syncLogId },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Retry failed");

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-logs"] });
      queryClient.invalidateQueries({ queryKey: ["production-logs"] });
      toast({
        title: "Sync retry successful",
        description: "The sync has been retried and completed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Retry failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const retryAllFailedMutation = useMutation({
    mutationFn: async () => {
      const failedLogs = syncLogs?.filter((log) => log.sync_status === "failed") || [];
      const results = await Promise.allSettled(
        failedLogs.map((log) =>
          supabase.functions.invoke("retry-failed-sync", {
            body: { sync_log_id: log.id },
          })
        )
      );

      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const failCount = results.filter((r) => r.status === "rejected").length;

      return { successCount, failCount, total: failedLogs.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["sync-logs"] });
      queryClient.invalidateQueries({ queryKey: ["production-logs"] });
      toast({
        title: "Bulk retry completed",
        description: `${result.successCount} of ${result.total} syncs retried successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Bulk retry failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredLogs = syncLogs?.filter((log) => {
    switch (activeTab) {
      case "pending":
        return log.sync_status === "pending";
      case "failed":
        return log.sync_status === "failed";
      case "success":
        return log.sync_status === "success";
      default:
        return true;
    }
  });

  const stats = {
    total: syncLogs?.length || 0,
    success: syncLogs?.filter((l) => l.sync_status === "success").length || 0,
    failed: syncLogs?.filter((l) => l.sync_status === "failed").length || 0,
    pending: syncLogs?.filter((l) => l.sync_status === "pending").length || 0,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="mr-1 h-3 w-3" />
            Success
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSyncTypeLabel = (syncType: string) => {
    const labels: Record<string, string> = {
      production_complete: "Production",
      grn: "Goods Receipt",
      goods_receipt: "Goods Receipt",
      stock_adjustment: "Stock Adjustment",
      po_create: "PO Create",
      po_cancel: "PO Cancel",
    };
    return labels[syncType] || syncType;
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Sync Monitor
            </h1>
            <p className="text-muted-foreground mt-2">
              Monitor and manage AutoCount synchronization
            </p>
          </div>
          <Button
            onClick={() => retryAllFailedMutation.mutate()}
            disabled={stats.failed === 0 || retryAllFailedMutation.isPending}
            variant="outline"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${retryAllFailedMutation.isPending ? "animate-spin" : ""}`}
            />
            Retry All Failed ({stats.failed})
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-muted">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Syncs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.success}</p>
                  <p className="text-xs text-muted-foreground">Successful</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sync Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Sync History</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
                <TabsTrigger value="failed">Failed ({stats.failed})</TabsTrigger>
                <TabsTrigger value="success">Success ({stats.success})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading sync logs...
                  </div>
                ) : !filteredLogs || filteredLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No sync logs found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>AC Doc No</TableHead>
                          <TableHead>Retries</TableHead>
                          <TableHead>Error</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap">
                              {log.created_at
                                ? format(new Date(log.created_at), "MMM dd, yyyy HH:mm")
                                : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {getSyncTypeLabel(log.sync_type)}
                              </Badge>
                            </TableCell>
                            <TableCell>{getStatusBadge(log.sync_status)}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {log.reference_id.slice(0, 8)}...
                            </TableCell>
                            <TableCell>{log.autocount_doc_no || "-"}</TableCell>
                            <TableCell>{log.retry_count || 0}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                              {log.error_message || "-"}
                            </TableCell>
                            <TableCell>
                              {log.sync_status === "failed" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => retryMutation.mutate(log.id)}
                                  disabled={retryMutation.isPending}
                                >
                                  <RefreshCw
                                    className={`h-4 w-4 ${
                                      retryMutation.isPending ? "animate-spin" : ""
                                    }`}
                                  />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
