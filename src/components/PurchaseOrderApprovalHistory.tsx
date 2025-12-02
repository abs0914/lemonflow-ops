import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import { format } from "date-fns";

interface PurchaseOrderApprovalHistoryProps {
  purchaseOrderId: string;
}

export function PurchaseOrderApprovalHistory({ purchaseOrderId }: PurchaseOrderApprovalHistoryProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ["po-approval-history", purchaseOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select(`
          *,
          user_profiles(full_name)
        `)
        .eq("entity_type", "purchase_order")
        .eq("entity_id", purchaseOrderId)
        .in("action", ["approved", "rejected", "submitted", "cancelled"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "rejected":
      case "cancelled":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "submitted":
        return <FileText className="h-4 w-4 text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "approved":
        return <Badge className="bg-green-600">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-600">Rejected</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "submitted":
        return <Badge className="bg-blue-600">Submitted</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Approval History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Approval History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No approval history available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((entry: any, index: number) => (
            <div
              key={entry.id}
              className="flex items-start gap-4 pb-4 border-b last:border-b-0 last:pb-0"
            >
              <div className="mt-1">{getActionIcon(entry.action)}</div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  {getActionBadge(entry.action)}
                  <span className="text-sm text-muted-foreground">
                    by {entry.user_profiles?.full_name || "Unknown User"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(entry.created_at), "MMM dd, yyyy 'at' h:mm a")}
                </p>
                {entry.details && entry.details.status_change && (
                  <p className="text-sm text-muted-foreground">
                    Status: {entry.details.status_change}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
