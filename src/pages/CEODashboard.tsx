import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Eye, Clock } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
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

export default function CEODashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [poToAction, setPOToAction] = useState<{ id: string; action: "approve" | "reject"; poNumber: string } | null>(null);

  // Fetch submitted POs awaiting approval
  const { data: pendingPOs, isLoading } = useQuery({
    queryKey: ["pending-pos-for-ceo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          suppliers(supplier_code, company_name),
          user_profiles!purchase_orders_created_by_fkey(full_name)
        `)
        .eq("status", "submitted")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Approve PO mutation
  const approveMutation = useMutation({
    mutationFn: async (poId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const now = new Date().toISOString();

      // Fetch PO details to check if it's cash purchase
      const { data: poData, error: fetchError } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(supplier_code, company_name)")
        .eq("id", poId)
        .single();

      if (fetchError) throw fetchError;

      // Update PO status
      const { error: updateError } = await supabase
        .from("purchase_orders")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: now,
        })
        .eq("id", poId);

      if (updateError) throw updateError;

      // Log to audit_logs
      const { error: auditError } = await supabase
        .from("audit_logs")
        .insert({
          entity_type: "purchase_order",
          entity_id: poId,
          action: "approved",
          user_id: user.id,
          details: {
            approved_at: now,
            status_change: "submitted -> approved"
          }
        });

      if (auditError) throw auditError;

      // Auto-sync to AutoCount if not cash purchase and not already synced
      if (!poData.is_cash_purchase && !poData.autocount_synced) {
        // Fetch PO lines
        const { data: linesData, error: linesError } = await supabase
          .from("purchase_order_lines")
          .select(`
            *,
            components(id, sku, name, unit, autocount_item_code),
            raw_materials(id, sku, name, unit, autocount_item_code)
          `)
          .eq("purchase_order_id", poId)
          .order("line_number", { ascending: true });

        if (linesError) throw linesError;

        // Sync to AutoCount
        const { data: syncData, error: syncError } = await supabase.functions.invoke("sync-po-create", {
          body: {
            poNumber: poData.po_number,
            supplierId: poData.supplier_id,
            docDate: poData.doc_date,
            deliveryDate: poData.delivery_date,
            remarks: poData.remarks,
            lines: linesData.map((line: any) => {
              const item = line.item_type === 'raw_material' ? line.raw_materials : line.components;
              return {
                itemCode: item?.autocount_item_code || item?.sku || "",
                description: item?.name || "",
                quantity: line.quantity,
                unitPrice: line.unit_price,
                uom: line.uom,
                lineRemarks: line.line_remarks,
              };
            }),
          },
        });

        if (!syncError && syncData) {
          // Update PO with AutoCount doc number
          await supabase
            .from("purchase_orders")
            .update({
              autocount_synced: true,
              autocount_doc_no: syncData.docNo,
            })
            .eq("id", poId);
        } else {
          console.error("AutoCount sync failed:", syncError);
          // Don't throw error - PO is approved even if sync fails
        }
      }

      return poData;
    },
    onSuccess: (data) => {
      const syncMessage = !data.is_cash_purchase && !data.autocount_synced 
        ? " and synced to AutoCount" 
        : "";
      toast({
        title: "Purchase Order Approved",
        description: `The purchase order has been approved successfully${syncMessage}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["pending-pos-for-ceo"] });
      setPOToAction(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reject PO mutation
  const rejectMutation = useMutation({
    mutationFn: async (poId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const now = new Date().toISOString();

      // Update PO status
      const { error: updateError } = await supabase
        .from("purchase_orders")
        .update({
          status: "cancelled",
        })
        .eq("id", poId);

      if (updateError) throw updateError;

      // Log to audit_logs
      const { error: auditError } = await supabase
        .from("audit_logs")
        .insert({
          entity_type: "purchase_order",
          entity_id: poId,
          action: "rejected",
          user_id: user.id,
          details: {
            rejected_at: now,
            status_change: "submitted -> cancelled"
          }
        });

      if (auditError) throw auditError;
    },
    onSuccess: () => {
      toast({
        title: "Purchase Order Rejected",
        description: "The purchase order has been rejected.",
      });
      queryClient.invalidateQueries({ queryKey: ["pending-pos-for-ceo"] });
      setPOToAction(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">CEO Dashboard</h1>
          <p className="text-muted-foreground">
            Review and approve pending purchase orders
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Approvals
            </CardTitle>
            <CardDescription>
              Purchase orders awaiting your approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : pendingPOs && pendingPOs.length > 0 ? (
              <div className="space-y-4">
                {pendingPOs.map((po: any) => (
                  <Card key={po.id} className="border-2 border-primary/20">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold">{po.po_number}</h3>
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending Approval
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Supplier:</span>{" "}
                              <span className="font-medium">{po.suppliers?.company_name}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Amount:</span>{" "}
                              <span className="font-medium">₱{po.total_amount.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Created By:</span>{" "}
                              <span className="font-medium">{po.user_profiles?.full_name}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Date:</span>{" "}
                              <span className="font-medium">{format(new Date(po.doc_date), "MMM dd, yyyy")}</span>
                            </div>
                          </div>

                          {po.remarks && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Remarks:</span>{" "}
                              <span>{po.remarks}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/purchase-orders/${po.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setPOToAction({ id: po.id, action: "approve", poNumber: po.po_number })}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setPOToAction({ id: po.id, action: "reject", poNumber: po.po_number })}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-lg">No pending purchase orders</p>
                <p className="text-sm">All purchase orders have been reviewed</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!poToAction} onOpenChange={() => setPOToAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {poToAction?.action === "approve" ? "Approve" : "Reject"} Purchase Order
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {poToAction?.action} purchase order <strong>{poToAction?.poNumber}</strong>?
              {poToAction?.action === "approve" 
                ? " This will allow the order to proceed to goods receiving."
                : " This will cancel the order and it cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (poToAction) {
                  if (poToAction.action === "approve") {
                    approveMutation.mutate(poToAction.id);
                  } else {
                    rejectMutation.mutate(poToAction.id);
                  }
                }
              }}
              className={poToAction?.action === "reject" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {poToAction?.action === "approve" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
