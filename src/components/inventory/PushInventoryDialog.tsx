import { useState, useEffect } from "react";
import { RefreshCw, AlertCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PushInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPushComplete: () => void;
}

export function PushInventoryDialog({ open, onOpenChange, onPushComplete }: PushInventoryDialogProps) {
  const [isPushing, setIsPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  const executePush = async () => {
    setIsPushing(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('push-inventory-to-autocount');
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: "Push Complete",
        description: `Created: ${data.results.created}, Updated: ${data.results.updated}, Failed: ${data.results.failed}`,
      });

      onPushComplete();
      onOpenChange(false);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to push inventory to AutoCount';
      setError(errorMessage);
      toast({
        title: "Push Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Push Inventory to AutoCount</DialogTitle>
          <DialogDescription>
            This will sync all local inventory items to AutoCount. New items will be created and existing items will be updated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Alert>
            <Upload className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold">Ready to Push</div>
              <div className="text-sm mt-1">
                All components in your local inventory will be synced to AutoCount.
              </div>
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPushing}>
              Cancel
            </Button>
            <Button onClick={executePush} disabled={isPushing}>
              {isPushing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Pushing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Push to AutoCount
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
