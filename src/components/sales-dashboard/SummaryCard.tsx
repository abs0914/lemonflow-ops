import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  loading?: boolean;
}

export function SummaryCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  loading,
}: SummaryCardProps) {
  const getTrendIcon = () => {
    if (change === undefined || change === 0) return Minus;
    return change > 0 ? TrendingUp : TrendingDown;
  };

  const TrendIcon = getTrendIcon();

  return (
    <Card>
      <CardContent className="p-6">
        {loading ? (
          <div className="space-y-3">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            <div className="h-3 w-20 bg-muted animate-pulse rounded" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {title}
              </span>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold">{value}</span>
            </div>
            {change !== undefined && (
              <div className="mt-2 flex items-center gap-1">
                <TrendIcon
                  className={cn(
                    "h-3 w-3",
                    change > 0 && "text-success",
                    change < 0 && "text-destructive",
                    change === 0 && "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-xs font-medium",
                    change > 0 && "text-success",
                    change < 0 && "text-destructive",
                    change === 0 && "text-muted-foreground"
                  )}
                >
                  {change > 0 ? "+" : ""}
                  {change.toFixed(1)}%
                </span>
                {changeLabel && (
                  <span className="text-xs text-muted-foreground">
                    {changeLabel}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
