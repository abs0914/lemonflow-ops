import { useState, useEffect } from "react";
import { RefreshCw, AlertCircle, Plus, FileEdit } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PreviewChange {
  action: 'create' | 'update' | 'none';
  itemCode: string;
  description: string;
  changes?: Record<string, { old: any; new: any }>;
}

interface SyncInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncComplete: () => void;
}

export function SyncInventoryDialog({ open, onOpenChange, onSyncComplete }: SyncInventoryDialogProps) {
  console.log('[SyncInventoryDialog] Component rendering, open:', open);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [preview, setPreview] = useState<PreviewChange[] | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    console.log('[SyncInventoryDialog] useEffect triggered, open:', open);
    if (open) {
      console.log('[SyncInventoryDialog] Dialog is open, calling loadPreview');
      loadPreview();
    } else {
      console.log('[SyncInventoryDialog] Dialog is closed, clearing state');
      setPreview(null);
      setSummary(null);
      setError(null);
    }
  }, [open]);

  const loadPreview = async () => {
    console.log('[SyncInventoryDialog] loadPreview called');
    setIsLoadingPreview(true);
    setError(null);
    try {
      console.log('[SyncInventoryDialog] Invoking sync-inventory-preview function');
      const { data, error } = await supabase.functions.invoke('sync-inventory-preview');
      
      console.log('[SyncInventoryDialog] Response:', { data, error });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setPreview(data.preview);
      setSummary(data.summary);
    } catch (error: any) {
      console.error('[SyncInventoryDialog] Error:', error);
      const errorMessage = error.message || 'Failed to load inventory from AutoCount';
      setError(errorMessage);
      setPreview([]);
      toast({
        title: "Preview Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const executeSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-inventory-execute');
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: "Sync Complete",
        description: `Created: ${data.results.created}, Updated: ${data.results.updated}`,
      });

      onSyncComplete();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Sync Inventory from AutoCount</DialogTitle>
          <DialogDescription>
            Review the changes that will be made to your local inventory records
          </DialogDescription>
        </DialogHeader>

        {isLoadingPreview ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading preview...</span>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold">Sync Preview Failed</div>
              <div className="text-sm mt-1">{error}</div>
            </AlertDescription>
          </Alert>
        ) : preview ? (
          <div className="space-y-4">
            {summary && (
              <div className="grid grid-cols-3 gap-4">
                <Alert>
                  <Plus className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold">{summary.toCreate}</div>
                    <div className="text-xs text-muted-foreground">New Items</div>
                  </AlertDescription>
                </Alert>
                <Alert>
                  <FileEdit className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold">{summary.toUpdate}</div>
                    <div className="text-xs text-muted-foreground">To Update</div>
                  </AlertDescription>
                </Alert>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold">{summary.noChange}</div>
                    <div className="text-xs text-muted-foreground">No Changes</div>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {preview.map((change, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{change.itemCode}</div>
                        <div className="text-sm text-muted-foreground">{change.description}</div>
                      </div>
                      <Badge
                        variant={
                          change.action === 'create'
                            ? 'default'
                            : change.action === 'update'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {change.action === 'create' && <Plus className="h-3 w-3 mr-1" />}
                        {change.action === 'update' && <FileEdit className="h-3 w-3 mr-1" />}
                        {change.action.charAt(0).toUpperCase() + change.action.slice(1)}
                      </Badge>
                    </div>

                    {change.changes && Object.keys(change.changes).length > 0 && (
                      <div className="text-xs space-y-1 bg-muted p-2 rounded">
                        {Object.entries(change.changes).map(([field, values]) => (
                          <div key={field} className="flex items-center gap-2">
                            <span className="font-medium">{field}:</span>
                            <span className="text-muted-foreground line-through">
                              {String(values.old)}
                            </span>
                            <span>→</span>
                            <span className="text-foreground">{String(values.new)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={executeSync}
                disabled={
                  isSyncing ||
                  (summary && summary.toCreate === 0 && summary.toUpdate === 0)
                }
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  'Execute Sync'
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
