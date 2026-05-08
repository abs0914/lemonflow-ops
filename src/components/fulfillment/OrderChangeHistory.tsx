import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOrderAuditLogs } from "@/hooks/useOrderAuditLogs";
import { format } from "date-fns";

const actionLabels: Record<string, string> = {
  line_added: "Item added",
  line_updated: "Item changed",
  line_deleted: "Item removed",
};

const actionColors: Record<string, string> = {
  line_added: "bg-green-100 text-green-800",
  line_updated: "bg-blue-100 text-blue-800",
  line_deleted: "bg-red-100 text-red-800",
};

export function OrderChangeHistory({ orderId }: { orderId: string }) {
  const { data: logs } = useOrderAuditLogs(orderId);
  const lineLogs = (logs || []).filter((l: any) => l.action?.startsWith("line_"));

  if (lineLogs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Order Change History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
        {lineLogs.map((log: any) => {
          const d = log.details || {};
          return (
            <div key={log.id} className="border-l-2 border-muted pl-3 pb-2 text-sm">
              <div className="flex items-center justify-between">
                <Badge className={actionColors[log.action] || ""}>
                  {actionLabels[log.action] || log.action}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(log.created_at), "MMM dd, HH:mm")}
                </span>
              </div>
              <div className="mt-1 text-foreground">
                <span className="font-medium">{log.user_name}</span>
                {d.before?.item_code && <> — {d.before.item_code}</>}
                {!d.before && d.after?.item_code && <> — {d.after.item_code}</>}
              </div>
              {log.action === "line_updated" && d.before && d.after && (
                <div className="text-xs text-muted-foreground mt-1">
                  Qty: {d.before.quantity} → {d.after.quantity}
                  {d.before.unit_price !== d.after.unit_price && (
                    <> · Price: ₱{d.before.unit_price} → ₱{d.after.unit_price}</>
                  )}
                </div>
              )}
              {log.action === "line_deleted" && d.before && (
                <div className="text-xs text-muted-foreground mt-1">
                  Removed qty {d.before.quantity} @ ₱{d.before.unit_price}
                </div>
              )}
              {log.action === "line_added" && d.after && (
                <div className="text-xs text-muted-foreground mt-1">
                  Added qty {d.after.quantity} @ ₱{d.after.unit_price}
                </div>
              )}
              {d.reason && (
                <div className="text-xs italic mt-1 text-muted-foreground">
                  Reason: {d.reason}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
