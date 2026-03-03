import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";

export function SyncReportTable() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["sync-report-logs", typeFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("autocount_sync_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (typeFilter !== "all") {
        query = query.eq("reference_type", typeFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq("sync_status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["sync-report-stats"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("autocount_sync_log")
        .select("sync_status")
        .gte("created_at", since);

      const total = data?.length ?? 0;
      const success = data?.filter((r) => r.sync_status === "success").length ?? 0;
      const failed = data?.filter((r) => r.sync_status === "failed").length ?? 0;
      const pending = data?.filter((r) => r.sync_status === "pending").length ?? 0;
      return { total, success, failed, pending };
    },
    refetchInterval: 30_000,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      sales_order: "bg-blue-100 text-blue-800 border-blue-200",
      store: "bg-purple-100 text-purple-800 border-purple-200",
      supplier: "bg-orange-100 text-orange-800 border-orange-200",
      purchase_order: "bg-teal-100 text-teal-800 border-teal-200",
    };
    return <Badge className={colors[type] || ""}>{type.replace("_", " ")}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total (24h)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats?.success ?? 0}</p>
              <p className="text-xs text-muted-foreground">Success</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{stats?.failed ?? 0}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{stats?.pending ?? 0}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="sales_order">Sales Orders</SelectItem>
            <SelectItem value="store">Stores</SelectItem>
            <SelectItem value="supplier">Suppliers</SelectItem>
            <SelectItem value="purchase_order">Purchase Orders</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sync History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Loading sync logs...</p>
          ) : logs && logs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Sync Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Doc No</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        <div>{log.created_at ? format(new Date(log.created_at), "MMM dd, HH:mm:ss") : "-"}</div>
                        <div className="text-xs text-muted-foreground">
                          {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : ""}
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(log.reference_type)}</TableCell>
                      <TableCell className="text-sm">{log.sync_type}</TableCell>
                      <TableCell>{getStatusBadge(log.sync_status)}</TableCell>
                      <TableCell className="text-sm font-mono">{log.autocount_doc_no || "-"}</TableCell>
                      <TableCell className="max-w-[250px]">
                        {log.error_message ? (
                          <p className="text-xs text-destructive truncate" title={log.error_message}>
                            {log.error_message.substring(0, 100)}
                          </p>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-4 text-center">No sync logs found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
