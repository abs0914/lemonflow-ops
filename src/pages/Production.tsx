import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Pencil } from "lucide-react";
import { useProductionLogs, ProductionLog } from "@/hooks/useProductionLogs";
import { LogProductionDialog, ProductionLogData } from "@/components/production/LogProductionDialog";
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
  const [editingLog, setEditingLog] = useState<ProductionLogData | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const { data: productionLogs, isLoading } = useProductionLogs();

  // Check if user has permission (Admin or Production role)
  if (user && profile && !["Admin", "Production", "Warehouse", "Fulfillment"].includes(profile.role)) {
    navigate("/");
    return null;
  }

  const formatShortageError = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    const marker = "BOM_SHORTAGE:";
    const idx = raw.indexOf(marker);
    if (idx === -1) return raw;
    const jsonStr = raw.slice(idx + marker.length).trim();
    try {
      const items = JSON.parse(jsonStr) as Array<{
        name: string;
        sku: string;
        unit?: string;
        required: number;
        available: number;
        short_by: number;
      }>;
      const lines = items.map(
        (i) =>
          `${i.name} (${i.sku}): need ${i.required} ${i.unit || ""}, available ${i.available}, short by ${Number(i.short_by).toFixed(3)}`
      );
      return `Insufficient stock to produce this quantity:\n• ${lines.join("\n• ")}`;
    } catch {
      return raw;
    }
  };

  const logProductionMutation = useMutation({
    mutationFn: async (data: {
      component_id: string;
      item_type: "component" | "raw_material";
      quantity: number;
      notes?: string;
      product_id?: string;
      parent_raw_material_id?: string;
    }) => {
      if (!user) throw new Error("User not authenticated");

      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "log_production",
        {
          p_item_type: data.item_type,
          p_item_id: data.component_id,
          p_quantity: data.quantity,
          p_notes: data.notes || null,
          p_product_id: data.product_id || null,
          p_parent_raw_material_id: data.parent_raw_material_id || null,
        }
      );
      if (rpcError) throw new Error(rpcError.message);

      const result = rpcResult as unknown as {
        movement_id: string;
        component_id: string | null;
        raw_material_id: string | null;
      };

      // AutoCount sync for component output only
      if (data.item_type === "component" && result.component_id) {
        try {
          const { error: syncError } = await supabase.functions.invoke(
            "sync-production-complete",
            {
              body: {
                movement_id: result.movement_id,
                component_id: result.component_id,
                quantity: data.quantity,
              },
            }
          );
          if (syncError) {
            console.error("AutoCount sync failed:", syncError);
            toast({
              title: "Production logged but sync failed",
              description:
                "Production was recorded locally but failed to sync to AutoCount.",
              variant: "destructive",
            });
          }
        } catch (syncError) {
          console.error("AutoCount sync error:", syncError);
        }
      }

      return { id: result.movement_id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-logs"] });
      queryClient.invalidateQueries({ queryKey: ["components"] });
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      setShowLogDialog(false);
      toast({
        title: "Production logged successfully",
        description: "Production has been recorded.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to log production",
        description: formatShortageError(error),
        variant: "destructive",
      });
    },
  });


  const updateProductionMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      component_id: string;
      item_type: "component" | "raw_material";
      quantity: number;
      oldQuantity: number;
      notes?: string;
      product_id?: string;
      parent_raw_material_id?: string;
    }) => {
      if (!user) throw new Error("User not authenticated");

      const { error: movementError } = await supabase
        .from("stock_movements")
        .update({
          quantity: data.quantity,
          notes: data.notes || null,
        })
        .eq("id", data.id);

      if (movementError) throw movementError;

      const quantityDiff = data.quantity - data.oldQuantity;
      if (quantityDiff !== 0) {
        if (data.item_type === "raw_material") {
          const { data: rm, error: fetchError } = await supabase
            .from("raw_materials")
            .select("stock_quantity")
            .eq("id", data.component_id)
            .single();
          if (fetchError) throw fetchError;
          const { error: updateError } = await supabase
            .from("raw_materials")
            .update({ stock_quantity: (rm?.stock_quantity || 0) + quantityDiff })
            .eq("id", data.component_id);
          if (updateError) throw updateError;
        } else {
          const { data: component, error: fetchError } = await supabase
            .from("components")
            .select("stock_quantity")
            .eq("id", data.component_id)
            .single();
          if (fetchError) throw fetchError;
          const { error: updateError } = await supabase
            .from("components")
            .update({ stock_quantity: (component?.stock_quantity || 0) + quantityDiff })
            .eq("id", data.component_id);
          if (updateError) throw updateError;
        }

        // Adjust BOM ingredient consumption by the delta
        let bomProductId = data.product_id;
        let bomParentRawId = data.parent_raw_material_id;
        if (!bomProductId && !bomParentRawId) {
          if (data.item_type === "raw_material") {
            bomParentRawId = data.component_id;
          } else {
            const { data: prodMatch } = await supabase
              .from("products")
              .select("id")
              .eq("component_id", data.component_id)
              .maybeSingle();
            bomProductId = prodMatch?.id;
          }
        }

        if (bomProductId || bomParentRawId) {
          let bomQuery = supabase
            .from("bom_items")
            .select("item_type, raw_material_id, component_id, quantity");
          if (bomProductId) {
            bomQuery = bomQuery.eq("product_id", bomProductId);
          } else if (bomParentRawId) {
            bomQuery = bomQuery.eq("parent_raw_material_id", bomParentRawId);
          }
          const { data: bomItems } = await bomQuery;
          for (const bi of bomItems || []) {
            const deduct = Number(bi.quantity) * quantityDiff;
            if (!deduct) continue;

            if (bi.item_type === "raw_material" && bi.raw_material_id) {
              await supabase.from("stock_movements").insert({
                item_id: bi.raw_material_id,
                item_type: "raw_material",
                movement_type: "assembly_consume",
                quantity: -deduct,
                performed_by: user.id,
                notes: `Adjustment for production edit (movement ${data.id})`,
                reference_type: "stock_movement",
                reference_id: data.id,
                autocount_synced: true,
              });
              const { data: rm } = await supabase
                .from("raw_materials")
                .select("stock_quantity")
                .eq("id", bi.raw_material_id)
                .maybeSingle();
              if (rm) {
                await supabase
                  .from("raw_materials")
                  .update({ stock_quantity: (Number(rm.stock_quantity) || 0) - deduct })
                  .eq("id", bi.raw_material_id);
              }
            } else if (bi.component_id) {
              await supabase.from("stock_movements").insert({
                item_id: bi.component_id,
                item_type: "component",
                movement_type: "assembly_consume",
                quantity: -deduct,
                performed_by: user.id,
                notes: `Adjustment for production edit (movement ${data.id})`,
                reference_type: "stock_movement",
                reference_id: data.id,
                autocount_synced: false,
              });
              const { data: c } = await supabase
                .from("components")
                .select("stock_quantity")
                .eq("id", bi.component_id)
                .maybeSingle();
              if (c) {
                await supabase
                  .from("components")
                  .update({ stock_quantity: (Number(c.stock_quantity) || 0) - deduct })
                  .eq("id", bi.component_id);
              }
            }
          }
        }
      }

      return { id: data.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-logs"] });
      queryClient.invalidateQueries({ queryKey: ["components"] });
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      setShowLogDialog(false);
      setEditingLog(null);
      toast({
        title: "Production log updated",
        description: "The production log has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update production log",
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

  const handleEdit = (log: ProductionLog) => {
    setEditingLog({
      id: log.id,
      item_id: log.item_id,
      item_type: log.item_type,
      quantity: log.quantity,
      notes: log.notes,
    });
    setShowLogDialog(true);
  };

  const handleSubmit = (data: { component_id: string; item_type: "component" | "raw_material"; quantity: number; notes?: string; product_id?: string; parent_raw_material_id?: string }) => {
    if (editingLog) {
      updateProductionMutation.mutate({
        id: editingLog.id,
        component_id: data.component_id,
        item_type: data.item_type,
        quantity: data.quantity,
        oldQuantity: editingLog.quantity,
        notes: data.notes,
        product_id: data.product_id,
        parent_raw_material_id: data.parent_raw_material_id,
      });
    } else {
      logProductionMutation.mutate(data);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setShowLogDialog(open);
    if (!open) {
      setEditingLog(null);
    }
  };

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
              <>
                {/* Mobile card view */}
                <div className="space-y-3 md:hidden">
                  {productionLogs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{log.components?.name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{log.components?.sku || "N/A"}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {log.autocount_synced ? (
                            <Badge variant="default">Synced</Badge>
                          ) : (
                            <>
                              <Badge variant="secondary">Pending</Badge>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => retrySyncMutation.mutate(log.id)}
                                disabled={retryingId === log.id}
                              >
                                <RefreshCw className={`h-3 w-3 ${retryingId === log.id ? "animate-spin" : ""}`} />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {format(new Date(log.created_at), "MMM dd, yyyy HH:mm")}
                        </span>
                        <span className="font-medium">Qty: {log.quantity}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{log.user_profiles?.full_name || "Unknown"}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleEdit(log)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {log.notes && (
                        <p className="text-xs text-muted-foreground">{log.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
                {/* Desktop table view */}
                <div className="hidden md:block">
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
                        <TableHead className="w-[50px]"></TableHead>
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
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => handleEdit(log)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <LogProductionDialog
          open={showLogDialog}
          onOpenChange={handleDialogClose}
          onSubmit={handleSubmit}
          isLoading={logProductionMutation.isPending || updateProductionMutation.isPending}
          editingLog={editingLog}
        />
      </div>
    </DashboardLayout>
  );
}
