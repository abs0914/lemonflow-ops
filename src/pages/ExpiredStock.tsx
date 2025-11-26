import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2, RotateCcw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ExpiredBatch {
  movement_id: string;
  batch_number: string;
  component_id: string;
  component_name: string;
  sku: string;
  quantity: number;
  unit_cost: number;
  expired_at: string;
  expiry_notes: string;
  marked_by_name: string;
}

export default function ExpiredStock() {
  const queryClient = useQueryClient();
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [writeOffDialogOpen, setWriteOffDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<ExpiredBatch | null>(null);
  const [expiryNotes, setExpiryNotes] = useState("");

  const { data: expiredBatches, isLoading } = useQuery({
    queryKey: ["expired-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*")
        .eq("is_expired", true)
        .eq("item_type", "component")
        .order("expired_at", { ascending: false });

      if (error) throw error;

      // Get component details
      const componentIds = [...new Set(data.map((b) => b.item_id))];
      const { data: components } = await supabase
        .from("components")
        .select("id, name, sku")
        .in("id", componentIds);

      const componentMap = new Map(components?.map((c) => [c.id, c]) || []);

      // Get user names
      const userIds = data.map((b) => b.marked_expired_by).filter(Boolean);
      const { data: users } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .in("id", userIds);

      const userMap = new Map(users?.map((u) => [u.id, u.full_name]) || []);

      return data.map((batch) => {
        const component = componentMap.get(batch.item_id);
        return {
          movement_id: batch.id,
          batch_number: batch.batch_number || "N/A",
          component_id: batch.item_id,
          component_name: component?.name || "Unknown",
          sku: component?.sku || "",
          quantity: batch.quantity,
          unit_cost: batch.unit_cost || 0,
          expired_at: batch.expired_at || "",
          expiry_notes: batch.expiry_notes || "",
          marked_by_name: userMap.get(batch.marked_expired_by) || "Unknown",
        };
      }) as ExpiredBatch[];
    },
  });

  const reinstateMutation = useMutation({
    mutationFn: async (movementId: string) => {
      const { error } = await supabase
        .from("stock_movements")
        .update({
          is_expired: false,
          expired_at: null,
          expiry_notes: null,
          marked_expired_by: null,
        })
        .eq("id", movementId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Batch reinstated successfully");
      queryClient.invalidateQueries({ queryKey: ["expired-stock"] });
    },
    onError: () => {
      toast.error("Failed to reinstate batch");
    },
  });

  const writeOffMutation = useMutation({
    mutationFn: async (batch: ExpiredBatch) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create stock adjustment OUT
      const { error: movementError } = await supabase.from("stock_movements").insert({
        item_id: batch.component_id,
        item_type: "component",
        movement_type: "out",
        quantity: batch.quantity,
        warehouse_location: "MAIN",
        performed_by: user.id,
        notes: `Write-off expired stock: ${batch.batch_number}. Reason: ${batch.expiry_notes}`,
        reference_type: "write_off",
        reference_id: batch.movement_id,
      });

      if (movementError) throw movementError;

      // Update component stock
      const { data: component } = await supabase
        .from("components")
        .select("stock_quantity")
        .eq("id", batch.component_id)
        .single();

      if (component) {
        await supabase
          .from("components")
          .update({ stock_quantity: Math.max(0, component.stock_quantity - batch.quantity) })
          .eq("id", batch.component_id);
      }

      // Remove expired flag (optional: keep for audit trail)
      await supabase
        .from("stock_movements")
        .update({ is_expired: false })
        .eq("id", batch.movement_id);
    },
    onSuccess: () => {
      toast.success("Expired stock written off successfully");
      queryClient.invalidateQueries({ queryKey: ["expired-stock"] });
      queryClient.invalidateQueries({ queryKey: ["components"] });
      setWriteOffDialogOpen(false);
      setSelectedBatch(null);
    },
    onError: (error) => {
      toast.error(`Failed to write off: ${error.message}`);
    },
  });

  const totalValue = expiredBatches?.reduce((sum, b) => sum + b.quantity * b.unit_cost, 0) || 0;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Expired Stock Management</h1>
            <p className="text-muted-foreground">Review and manage expired inventory batches</p>
          </div>
          <Card className="w-64">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="text-sm text-muted-foreground">Total Expired Value</p>
              </div>
              <p className="text-3xl font-bold text-destructive">${totalValue.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Expired Batches</CardTitle>
          </CardHeader>
          <CardContent>
            {!expiredBatches || expiredBatches.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No expired stock flagged</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch Number</TableHead>
                    <TableHead>Component</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Expired Date</TableHead>
                    <TableHead>Marked By</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiredBatches.map((batch) => (
                    <TableRow key={batch.movement_id}>
                      <TableCell className="font-mono text-sm">{batch.batch_number}</TableCell>
                      <TableCell className="font-medium">{batch.component_name}</TableCell>
                      <TableCell className="font-mono text-sm">{batch.sku}</TableCell>
                      <TableCell className="text-right">{batch.quantity}</TableCell>
                      <TableCell className="text-right">${batch.unit_cost.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${(batch.quantity * batch.unit_cost).toFixed(2)}
                      </TableCell>
                      <TableCell>{format(new Date(batch.expired_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{batch.marked_by_name}</TableCell>
                      <TableCell className="max-w-xs truncate">{batch.expiry_notes}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => reinstateMutation.mutate(batch.movement_id)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setSelectedBatch(batch);
                              setWriteOffDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={writeOffDialogOpen} onOpenChange={setWriteOffDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Write Off Expired Stock</AlertDialogTitle>
              <AlertDialogDescription>
                This will create a stock adjustment OUT and reduce inventory. This action cannot be undone.
                <br />
                <br />
                <strong>Batch:</strong> {selectedBatch?.batch_number}
                <br />
                <strong>Component:</strong> {selectedBatch?.component_name}
                <br />
                <strong>Quantity:</strong> {selectedBatch?.quantity}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedBatch && writeOffMutation.mutate(selectedBatch)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Write Off
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
