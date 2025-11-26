import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Factory, Plus, RefreshCw, CheckCircle2, Edit, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useAssemblyOrders, AssemblyOrder } from "@/hooks/useAssemblyOrders";
import { MobileAssemblyOrderCard } from "@/components/production/MobileAssemblyOrderCard";
import { OrderActionSheet } from "@/components/production/OrderActionSheet";
import { DeleteAssemblyOrderDialog } from "@/components/production/DeleteAssemblyOrderDialog";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { dateFormatters } from "@/lib/datetime";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Production() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: openOrders = [], isLoading: loadingOpen, refetch: refetchOpen } = useAssemblyOrders("pending");
  const { data: completedOrders = [], isLoading: loadingCompleted, refetch: refetchCompleted } = useAssemblyOrders("completed");
  
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AssemblyOrder | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  const handleOpenActions = (order: AssemblyOrder) => {
    setSelectedOrder(order);
    setActionSheetOpen(true);
  };

  const completeMutation = useMutation({
    mutationFn: async (order: AssemblyOrder) => {
      // 1. Fetch BOM items for this product
      const { data: bomItems, error: bomError } = await supabase
        .from("bom_items")
        .select(`
          component_id,
          quantity,
          components(name, sku, stock_quantity, reserved_quantity, autocount_item_code)
        `)
        .eq("product_id", order.product_id);

      if (bomError) throw bomError;
      if (!bomItems || bomItems.length === 0) {
        throw new Error("No BOM items found for this product");
      }

      // 2. Check if sufficient stock is available
      const insufficientStock: string[] = [];
      bomItems.forEach((item) => {
        const requiredQty = item.quantity * order.quantity;
        const availableQty = (item.components?.stock_quantity || 0) - (item.components?.reserved_quantity || 0);
        
        if (availableQty < requiredQty) {
          insufficientStock.push(
            `${item.components?.name}: need ${requiredQty}, have ${availableQty}`
          );
        }
      });

      if (insufficientStock.length > 0) {
        throw new Error(`Insufficient stock:\n${insufficientStock.join("\n")}`);
      }

      // 3. Create stock movements for component consumption
      const componentConsumptions = bomItems.map((item) => ({
        movement_type: "consumption",
        item_type: "component",
        item_id: item.component_id,
        quantity: -(item.quantity * order.quantity),
        quantity_in_base_unit: -(item.quantity * order.quantity),
        performed_by: profile!.id,
        reference_type: "assembly_order",
        reference_id: order.id,
        notes: `Consumed for assembly order`,
      }));

      const { error: consumptionError } = await supabase
        .from("stock_movements")
        .insert(componentConsumptions);

      if (consumptionError) throw consumptionError;

      // 4. Create stock movement for finished product addition
      const { error: productionError } = await supabase
        .from("stock_movements")
        .insert({
          movement_type: "production",
          item_type: "product",
          item_id: order.product_id,
          quantity: order.quantity,
          quantity_in_base_unit: order.quantity,
          performed_by: profile!.id,
          reference_type: "assembly_order",
          reference_id: order.id,
          notes: `Produced from assembly order`,
        });

      if (productionError) throw productionError;

      // 5. Release stock reservation if it was reserved
      if (order.stock_reserved) {
        const { error: releaseError } = await supabase.rpc("release_stock_reservation", {
          p_assembly_order_id: order.id,
          p_product_id: order.product_id,
          p_quantity: order.quantity,
        });

        if (releaseError) {
          console.error("Error releasing stock reservation:", releaseError);
        }
      }

      // 6. Sync to AutoCount Stock Assembly
      const { error: syncError } = await supabase.functions.invoke("sync-assembly-complete", {
        body: {
          assemblyOrderId: order.id,
          productId: order.product_id,
          productQuantity: order.quantity,
          componentConsumptions: bomItems.map((item) => ({
            componentId: item.component_id,
            quantity: item.quantity * order.quantity,
          })),
          warehouseLocation: "MAIN",
          notes: order.notes || `Assembly: ${order.products?.name}`,
        },
      });

      if (syncError) {
        console.error("AutoCount sync error:", syncError);
        // Don't throw - assembly is complete, just log the sync error
      }

      return order;
    },
    onSuccess: () => {
      toast({ 
        title: "Assembly Completed",
        description: "Components consumed, product added to inventory, and synced to AutoCount" 
      });
      queryClient.invalidateQueries({ queryKey: ["assembly-orders"] });
      queryClient.invalidateQueries({ queryKey: ["components"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      setActionSheetOpen(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Assembly Failed", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (order: AssemblyOrder) => {
      const { error } = await supabase
        .from("assembly_orders")
        .update({ status: "cancelled" })
        .eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Order cancelled" });
      queryClient.invalidateQueries({ queryKey: ["assembly-orders"] });
      setActionSheetOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("assembly_orders")
        .delete()
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Order Deleted",
        description: "Successfully deleted the assembly order",
      });
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["assembly-orders"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (order: AssemblyOrder) => {
    setOrderToDelete(order.id);
    setDeleteDialogOpen(true);
    setActionSheetOpen(false);
  };

  const handleConfirmDelete = () => {
    if (orderToDelete) {
      deleteMutation.mutate(orderToDelete);
    }
  };

  useEffect(() => {
    if (!loading && !profile) {
      navigate("/login");
    }
    if (!loading && profile && !["Admin", "Production"].includes(profile.role)) {
      navigate("/login");
    }
  }, [profile, loading, navigate]);

  if (loading || !profile) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Production</h1>
            <p className="text-muted-foreground mt-2">
              Manage assembly orders and production workflow
            </p>
          </div>
          {!isMobile && (
            <Button 
              onClick={() => navigate("/production/create")}
              size="lg"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create Assembly Order
            </Button>
          )}
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Open Assembly Orders</CardTitle>
            <CardDescription>
              View and manage your production orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingOpen ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : openOrders.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center space-y-4">
                  <Factory className="h-12 w-12 mx-auto" />
                  <div>
                    <p className="font-medium">No open assembly orders</p>
                    <p className="text-sm">Create your first production order to get started</p>
                  </div>
                  <Button 
                    onClick={() => navigate("/production/create")}
                    variant="outline"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Order
                  </Button>
                </div>
              </div>
            ) : isMobile ? (
              <div className="space-y-3">
                {openOrders.map((order) => (
                  <MobileAssemblyOrderCard
                    key={order.id}
                    order={order}
                    onOpenActions={handleOpenActions}
                  />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.products?.name}</TableCell>
                      <TableCell>{order.products?.sku}</TableCell>
                      <TableCell>{order.quantity}</TableCell>
                      <TableCell>{order.user_profiles?.full_name}</TableCell>
                      <TableCell>
                        {order.due_date ? dateFormatters.medium(order.due_date) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{order.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => completeMutation.mutate(order)}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Mark Complete
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/production/edit/${order.id}`)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Order
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteClick(order)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Order
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Completed Assembly Orders</CardTitle>
            <CardDescription>
              History of completed production orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCompleted ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : completedOrders.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p>No completed assembly orders</p>
              </div>
            ) : isMobile ? (
              <div className="space-y-3">
                {completedOrders.map((order) => (
                  <MobileAssemblyOrderCard
                    key={order.id}
                    order={order}
                    onOpenActions={handleOpenActions}
                  />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.products?.name}</TableCell>
                      <TableCell>{order.products?.sku}</TableCell>
                      <TableCell>{order.quantity}</TableCell>
                      <TableCell>{order.user_profiles?.full_name}</TableCell>
                      <TableCell>{dateFormatters.medium(order.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/production/edit/${order.id}`)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Order
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteClick(order)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Order
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mobile FAB */}
      {isMobile && (
        <FloatingActionButton
          icon={Plus}
          label="Quick Actions"
          actions={[
            {
              icon: Plus,
              label: "Create Order",
              onClick: () => navigate("/production/create"),
            },
            {
              icon: RefreshCw,
              label: "Refresh",
              onClick: () => {
                refetchOpen();
                refetchCompleted();
              },
            },
          ]}
        />
      )}

      {/* Order Action Sheet */}
      <OrderActionSheet
        order={selectedOrder}
        open={actionSheetOpen}
        onOpenChange={setActionSheetOpen}
        onComplete={(order) => completeMutation.mutate(order)}
        onCancel={(order) => cancelMutation.mutate(order)}
        onDelete={handleDeleteClick}
      />

      <DeleteAssemblyOrderDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        orderCount={1}
        isDeleting={deleteMutation.isPending}
      />
    </DashboardLayout>
  );
}
