import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Download, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SyncError {
  store: string;
  storeCode: string;
  error: string;
  operation: string;
}

interface SyncResult {
  success: boolean;
  synced: number;
  total: number;
  errors?: SyncError[];
}

interface SyncErrorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: SyncResult | null;
}

export function SyncErrorsDialog({ open, onOpenChange, result }: SyncErrorsDialogProps) {
  if (!result) return null;

  const handleDownloadErrors = () => {
    if (!result.errors) return;
    
    const blob = new Blob([JSON.stringify(result.errors, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sync-errors-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const hasErrors = result.errors && result.errors.length > 0;
  const allFailed = result.synced === 0 && hasErrors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {allFailed ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : hasErrors ? (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            )}
            Sync Results
          </DialogTitle>
          <DialogDescription>
            {result.synced} of {result.total} stores synced successfully
            {hasErrors && ` • ${result.errors!.length} failed`}
          </DialogDescription>
        </DialogHeader>

        {hasErrors && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Error Details
              </span>
              <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
                <Download className="mr-2 h-4 w-4" />
                Download JSON
              </Button>
            </div>
            
            <ScrollArea className="h-[300px] rounded-md border p-4">
              <div className="space-y-4">
                {result.errors!.map((err, index) => (
                  <div key={index} className="border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{err.store}</span>
                      <Badge variant="outline" className="text-xs">
                        {err.storeCode}
                      </Badge>
                      <Badge 
                        variant={err.operation === 'create' ? 'secondary' : 'default'}
                        className="text-xs"
                      >
                        {err.operation}
                      </Badge>
                    </div>
                    <p className="text-sm text-destructive break-words">
                      {err.error}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {!hasErrors && (
          <div className="py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
            <p className="text-muted-foreground">
              All {result.total} stores synced successfully to AutoCount!
            </p>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
