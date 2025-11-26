import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface SyncStatusBadgeProps {
  synced: boolean;
  syncedAt?: string | null;
  docNo?: string | null;
  className?: string;
}

export function SyncStatusBadge({ synced, syncedAt, docNo, className }: SyncStatusBadgeProps) {
  if (synced) {
    return (
      <Badge
        className={cn(
          "bg-success/10 text-success hover:bg-success/20",
          className
        )}
        title={`Synced at: ${syncedAt || 'N/A'}${docNo ? `\nDoc No: ${docNo}` : ''}`}
      >
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Synced
      </Badge>
    );
  }

  return (
    <Badge
      className={cn(
        "bg-muted text-muted-foreground hover:bg-muted/80",
        className
      )}
    >
      <XCircle className="mr-1 h-3 w-3" />
      Not Synced
    </Badge>
  );
}

interface SyncingBadgeProps {
  className?: string;
}

export function SyncingBadge({ className }: SyncingBadgeProps) {
  return (
    <Badge
      className={cn(
        "bg-primary/10 text-primary hover:bg-primary/20 animate-pulse",
        className
      )}
    >
      <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
      Syncing...
    </Badge>
  );
}

interface PendingSyncBadgeProps {
  className?: string;
}

export function PendingSyncBadge({ className }: PendingSyncBadgeProps) {
  return (
    <Badge
      className={cn(
        "bg-warning/10 text-warning hover:bg-warning/20",
        className
      )}
    >
      <Clock className="mr-1 h-3 w-3" />
      Pending Sync
    </Badge>
  );
}
