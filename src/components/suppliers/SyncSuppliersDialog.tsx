import { useState, useEffect } from "react";
import { RefreshCw, AlertCircle, CheckCircle, Plus, FileEdit } from "lucide-react";
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
  supplierCode: string;
  companyName: string;
  changes?: Record<string, { old: any; new: any }>;
}

interface SyncSuppliersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncComplete: () => void;
}

export function SyncSuppliersDialog({ open, onOpenChange, onSyncComplete }: SyncSuppliersDialogProps) {
  console.log('[SyncSuppliersDialog] Component rendering, open:', open);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [preview, setPreview] = useState<PreviewChange[] | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    console.log('[SyncSuppliersDialog] useEffect triggered, open:', open);
    if (open) {
      console.log('[SyncSuppliersDialog] Dialog is open, calling loadPreview');
      loadPreview();
    } else {
      console.log('[SyncSuppliersDialog] Dialog is closed, clearing state');
      setPreview(null);
      setSummary(null);
      setError(null);
    }
  }, [open]);

  const loadPreview = async () => {
    console.log('[SyncSuppliersDialog] loadPreview called');
    setIsLoadingPreview(true);
    setError(null);
    try {
      console.log('[SyncSuppliersDialog] Invoking sync-suppliers-preview function');
      const { data, error } = await supabase.functions.invoke('sync-suppliers-preview');
      
      console.log('[SyncSuppliersDialog] Response:', { data, error });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setPreview(data.preview);
      setSummary(data.summary);
    } catch (error: any) {
      console.error('[SyncSuppliersDialog] Error:', error);
      const errorMessage = error.message || 'Failed to load suppliers from AutoCount';
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
      const { data, error } = await supabase.functions.invoke('sync-suppliers-execute');
      
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

  const handleOpenChange = (newOpen: boolean) => {
    console.log('[SyncSuppliersDialog] handleOpenChange called with:', newOpen);
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Sync Suppliers from AutoCount</DialogTitle>
          <DialogDescription>
            Review the changes that will be made to your local supplier records
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
                    <div className="text-xs text-muted-foreground">New Suppliers</div>
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
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold">{summary.noChange}</div>
                    <div className="text-xs text-muted-foreground">No Changes</div>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <ScrollArea className="h-[400px] rounded-md border p-4">
              <div className="space-y-3">
                {preview
                  .filter(item => item.action !== 'none')
                  .map((item, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{item.companyName}</div>
                          <div className="text-sm text-muted-foreground">{item.supplierCode}</div>
                        </div>
                        <Badge variant={item.action === 'create' ? 'default' : 'secondary'}>
                          {item.action === 'create' ? 'New' : 'Update'}
                        </Badge>
                      </div>
                      {item.changes && (
                        <div className="text-sm space-y-1">
                          {Object.entries(item.changes).map(([field, change]) => (
                            <div key={field} className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground capitalize">
                                {field.replace(/_/g, ' ')}:
                              </span>
                              <span className="line-through text-destructive">
                                {change.old || '(empty)'}
                              </span>
                              <span>→</span>
                              <span className="text-green-600">{change.new || '(empty)'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                {preview.filter(item => item.action !== 'none').length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    All suppliers are up to date
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={executeSync} 
                disabled={isSyncing || summary?.toCreate + summary?.toUpdate === 0}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Execute Sync
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
