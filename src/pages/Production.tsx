import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { useProductionLogs } from "@/hooks/useProductionLogs";
import { LogProductionDialog } from "@/components/production/LogProductionDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function Production() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const { data: productionLogs, isLoading } = useProductionLogs();

  // Check if user has permission (Admin or Production role)
  if (user && profile && !["Admin", "Production"].includes(profile.role)) {
    navigate("/");
    return null;
  }

  const logProductionMutation = useMutation({
    mutationFn: async (data: {
      component_id: string;
      quantity: number;
      notes?: string;
    }) => {
      if (!user) throw new Error("User not authenticated");

      // Create stock movement
      const { data: movement, error: movementError } = await supabase
        .from("stock_movements")
        .insert({
          item_id: data.component_id,
          item_type: "component",
          movement_type: "assembly_produce",
          quantity: data.quantity,
          performed_by: user.id,
          notes: data.notes || null,
          autocount_synced: false,
        })
        .select()
        .single();

      if (movementError) throw movementError;

      // Get current stock quantity
      const { data: component, error: fetchError } = await supabase
        .from("components")
        .select("stock_quantity")
        .eq("id", data.component_id)
        .single();

      if (fetchError) throw fetchError;

      // Update component stock quantity
      const { error: updateError } = await supabase
        .from("components")
        .update({
          stock_quantity: (component?.stock_quantity || 0) + data.quantity,
        })
        .eq("id", data.component_id);

      if (updateError) throw updateError;

      // Sync to AutoCount
      try {
        const { error: syncError } = await supabase.functions.invoke(
          "sync-production-complete",
          {
            body: {
              movement_id: movement.id,
              component_id: data.component_id,
              quantity: data.quantity,
            },
          }
        );

        if (syncError) {
          console.error("AutoCount sync failed:", syncError);
          toast({
            title: "Production logged but sync failed",
            description: "Production was recorded locally but failed to sync to AutoCount.",
            variant: "destructive",
          });
        }
      } catch (syncError) {
        console.error("AutoCount sync error:", syncError);
      }

      return movement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-logs"] });
      queryClient.invalidateQueries({ queryKey: ["components"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      setShowLogDialog(false);
      toast({
        title: "Production logged successfully",
        description: "Production has been recorded and synced to AutoCount.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to log production",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const retrySyncMutation = useMutation({
    mutationFn: async (movementId: string) => {
      setRetryingId(movementId);
      const { data, error } = await supabase.functions.invoke("retry-failed-sync", {
        body: { 
          reference_id: movementId,
          sync_type: "production_complete"
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Retry failed");

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-logs"] });
      queryClient.invalidateQueries({ queryKey: ["sync-logs"] });
      toast({
        title: "Sync retry successful",
        description: "Production has been synced to AutoCount.",
      });
      setRetryingId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Retry failed",
        description: error.message,
        variant: "destructive",
      });
      setRetryingId(null);
    },
  });

  const pendingSyncCount = productionLogs?.filter(log => !log.autocount_synced).length || 0;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Production</h1>
            <p className="text-muted-foreground mt-2">
              Log completed production and track history
            </p>
          </div>
          <Button onClick={() => setShowLogDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Log Production
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Production History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading production logs...
              </div>
            ) : !productionLogs || productionLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No production logs yet. Click "Log Production" to record completed production.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Logged By</TableHead>
                    <TableHead>Sync Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productionLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {format(new Date(log.created_at), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.components?.name || "Unknown"}
                      </TableCell>
                      <TableCell>{log.components?.sku || "N/A"}</TableCell>
                      <TableCell>{log.quantity}</TableCell>
                      <TableCell>
                        {log.user_profiles?.full_name || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {log.autocount_synced ? (
                            <Badge variant="default">Synced</Badge>
                          ) : (
                            <>
                              <Badge variant="secondary">Pending</Badge>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => retrySyncMutation.mutate(log.id)}
                                    disabled={retryingId === log.id}
                                  >
                                    <RefreshCw className={`h-3 w-3 ${retryingId === log.id ? "animate-spin" : ""}`} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Retry sync</TooltipContent>
                              </Tooltip>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.notes || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <LogProductionDialog
          open={showLogDialog}
          onOpenChange={setShowLogDialog}
          onSubmit={(data) => logProductionMutation.mutate(data)}
          isLoading={logProductionMutation.isPending}
        />
      </div>
    </DashboardLayout>
  );
}
