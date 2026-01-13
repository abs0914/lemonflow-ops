import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Send } from "lucide-react";
import { useUserStores, usePrimaryStore } from "@/hooks/useUserStore";
import { useStores } from "@/hooks/useStores";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateSalesOrder, useUpdateSalesOrder } from "@/hooks/useSalesOrders";
import { ItemSelector } from "@/components/store-orders/ItemSelector";
import { OrderLineForm } from "@/components/store-orders/OrderLineForm";
import { SalesOrderLine } from "@/types/sales-order";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export default function StoreOrderCreate() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: userStores } = useUserStores();
  const { data: allStores } = useStores();
  const primaryStore = usePrimaryStore();
  const createMutation = useCreateSalesOrder();
  const updateMutation = useUpdateSalesOrder();

  // Operational roles see all stores, Store role sees only assigned stores
  const operationalRoles = ["Admin", "Warehouse", "Fulfillment", "Production"];
  const isOperationalRole = profile?.role && operationalRoles.includes(profile.role);

  const [storeId, setStoreId] = useState<string>(primaryStore?.store_id || "");
  const [docDate, setDocDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [deliveryDate, setDeliveryDate] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [lines, setLines] = useState<Omit<SalesOrderLine, 'id' | 'sales_order_id' | 'created_at' | 'updated_at'>[]>([]);

  // Get selected store info from either all stores or user stores
  const selectedStore = isOperationalRole 
    ? allStores?.find(s => s.id === storeId)
    : userStores?.find(s => s.store_id === storeId)?.stores;

  const handleAddLine = (line: Omit<SalesOrderLine, 'id' | 'sales_order_id' | 'created_at' | 'updated_at' | 'line_number'>) => {
    setLines([...lines, { ...line, line_number: lines.length + 1 }]);
  };

  const handleRemoveLine = (index: number) => {
    const updatedLines = lines.filter((_, i) => i !== index);
    // Renumber lines
    setLines(updatedLines.map((line, i) => ({ ...line, line_number: i + 1 })));
  };

  const handleSaveDraft = async () => {
    if (!storeId || lines.length === 0) {
      toast.error("Please select a store and add at least one item");
      return;
    }

    await createMutation.mutateAsync({
      store_id: storeId,
      debtor_code: selectedStore?.debtor_code || "",
      doc_date: docDate,
      delivery_date: deliveryDate || undefined,
      description: description || undefined,
      lines,
    });

    navigate("/store/orders");
  };

  const handleSubmitOrder = async () => {
    if (!storeId || lines.length === 0) {
      toast.error("Please select a store and add at least one item");
      return;
    }

    const order = await createMutation.mutateAsync({
      store_id: storeId,
      debtor_code: selectedStore?.debtor_code || "",
      doc_date: docDate,
      delivery_date: deliveryDate || undefined,
      description: description || undefined,
      lines,
    });

    const isFranchisee = selectedStore?.store_type === "franchisee";

    if (isFranchisee) {
      // Franchisee: Reserve stock and send to Finance for payment confirmation
      const { data: reserveResult, error: reserveError } = await supabase.rpc(
        "reserve_stock_for_sales_order",
        { p_sales_order_id: order.id }
      );

      if (reserveError) {
        toast.error(`Stock reservation failed: ${reserveError.message}`);
        return;
      }

      const result = reserveResult as { success: boolean; message?: string } | null;
      if (!result?.success) {
        toast.error(result?.message || "Failed to reserve stock");
        return;
      }

      await updateMutation.mutateAsync({
        id: order.id,
        updates: { 
          status: "pending_payment", 
          submitted_at: new Date().toISOString() 
        },
      });

      toast.success("Order submitted for payment confirmation");
    } else {
      // Own store: Go to submitted for Fulfillment approval
      await updateMutation.mutateAsync({
        id: order.id,
        updates: { 
          status: "submitted", 
          submitted_at: new Date().toISOString() 
        },
      });

      toast.success("Order submitted for fulfillment");
    }

    navigate("/store/orders");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/store/orders")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create Sales Order</h1>
            <p className="text-muted-foreground">
              Create a new order for your store
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="store">Store *</Label>
                  <Select value={storeId} onValueChange={setStoreId}>
                    <SelectTrigger id="store">
                      <SelectValue placeholder="Select store" />
                    </SelectTrigger>
                    <SelectContent>
                      {isOperationalRole
                        ? allStores?.map((store) => (
                            <SelectItem key={store.id} value={store.id}>
                              {store.store_name} ({store.store_code})
                            </SelectItem>
                          ))
                        : userStores?.map((assignment) => (
                            <SelectItem key={assignment.store_id} value={assignment.store_id}>
                              {assignment.stores?.store_name} ({assignment.stores?.store_code})
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="docDate">Order Date *</Label>
                  <Input
                    id="docDate"
                    type="date"
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deliveryDate">Delivery Date</Label>
                  <Input
                    id="deliveryDate"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description / Notes</Label>
                <Textarea
                  id="description"
                  placeholder="Add any notes or special instructions..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ItemSelector onAddItem={handleAddLine} />
              <OrderLineForm lines={lines} onRemoveLine={handleRemoveLine} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => navigate("/store/orders")}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={createMutation.isPending || lines.length === 0}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Draft
            </Button>
            <Button
              onClick={handleSubmitOrder}
              disabled={createMutation.isPending || updateMutation.isPending || lines.length === 0}
            >
              <Send className="mr-2 h-4 w-4" />
              Submit Order
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
