import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePendingReceiptPOs } from "@/hooks/useFinanceProcurementStats";
import { formatCurrency } from "@/lib/currency";
import { dateFormatters } from "@/lib/datetime";
import { Package, ArrowRight, AlertTriangle, Clock } from "lucide-react";
import { differenceInDays } from "date-fns";

export function PendingReceiptPOsWidget() {
  const navigate = useNavigate();
  const { data: pendingPOs, isLoading } = usePendingReceiptPOs();

  const isOverdue = (deliveryDate: string | null) => {
    if (!deliveryDate) return false;
    return differenceInDays(new Date(), new Date(deliveryDate)) > 0;
  };

  const getDaysStatus = (deliveryDate: string | null) => {
    if (!deliveryDate) return null;
    const days = differenceInDays(new Date(deliveryDate), new Date());
    if (days < 0) {
      return { label: `${Math.abs(days)}d overdue`, variant: "destructive" as const };
    } else if (days === 0) {
      return { label: "Due today", variant: "secondary" as const };
    } else if (days <= 3) {
      return { label: `${days}d remaining`, variant: "secondary" as const };
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pending Goods Receipt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const overduePOs = pendingPOs?.filter(po => isOverdue(po.delivery_date)) || [];
  const totalPendingValue = pendingPOs?.reduce((sum, po) => sum + (po.total_amount || 0), 0) || 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pending Goods Receipt
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate("/purchasing")}>
            View All
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{pendingPOs?.length || 0} POs pending</span>
          <span>•</span>
          <span>{formatCurrency(totalPendingValue)} total</span>
          {overduePOs.length > 0 && (
            <>
              <span>•</span>
              <span className="text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {overduePOs.length} overdue
              </span>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {pendingPOs?.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No pending goods receipts</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {pendingPOs?.slice(0, 5).map((po) => {
              const daysStatus = getDaysStatus(po.delivery_date);
              return (
                <div
                  key={po.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/purchasing/${po.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-sm">{po.po_number}</span>
                      {daysStatus && (
                        <Badge variant={daysStatus.variant} className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {daysStatus.label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {po.suppliers?.company_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(po.total_amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {po.delivery_date ? dateFormatters.short(po.delivery_date) : "No date"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
