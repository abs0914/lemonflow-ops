import { useState, useEffect } from "react";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Save, Send, User, MapPin, AlertTriangle } from "lucide-react";
import { useUserStores, usePrimaryStore } from "@/hooks/useUserStore";
import { useCreateSalesOrder, useUpdateSalesOrder } from "@/hooks/useSalesOrders";
import { useValidateItemCodes } from "@/hooks/useValidateItemCodes";
import { QuickOrderInput } from "@/components/store-orders/QuickOrderInput";
import { ParsedOrderTable } from "@/components/store-orders/ParsedOrderTable";
import { parseOrderText, ParsedOrderItem, validateParsedItems } from "@/lib/orderParser";
import { SalesOrderLine } from "@/types/sales-order";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export default function StoreOrderQuickEntry() {
  const navigate = useNavigate();
  const { data: userStores } = useUserStores();
  const primaryStore = usePrimaryStore();
  const createMutation = useCreateSalesOrder();
  const updateMutation = useUpdateSalesOrder();

  // Form state
  const [storeId, setStoreId] = useState<string>(primaryStore?.store_id || "");
  const [docDate, setDocDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [deliveryDate, setDeliveryDate] = useState<string>("");
  
  // Parser state
  const [orderText, setOrderText] = useState<string>("");
  const [parsedItems, setParsedItems] = useState<ParsedOrderItem[]>([]);
  const [branch, setBranch] = useState<string>("");
  const [requester, setRequester] = useState<string>("");
  const [unparsedLines, setUnparsedLines] = useState<string[]>([]);
  const [isParsed, setIsParsed] = useState(false);

  // Get item codes for validation
  const itemCodes = parsedItems.map(item => item.itemCode);
  const { data: validationData, isLoading: isValidating } = useValidateItemCodes(itemCodes);

  // Update validation status when validation data changes
  useEffect(() => {
    if (validationData && parsedItems.length > 0) {
      const validated = validateParsedItems(parsedItems, validationData.validCodes);
      setParsedItems(validated);
    }
  }, [validationData?.validCodes]);

  const selectedStore = userStores?.find(s => s.store_id === storeId);

  const handleParse = () => {
    if (!storeId) {
      toast.error("Please select a store first");
      return;
    }

    const result = parseOrderText(orderText);
    
    setParsedItems(result.items);
    setBranch(result.branch || "");
    setRequester(result.requester || "");
    setUnparsedLines(result.unparsedLines);
    setIsParsed(true);

    if (result.items.length === 0) {
      toast.warning("No items could be parsed from the text");
    } else {
      toast.success(`Parsed ${result.items.length} item(s)`);
    }
  };

  const handleClear = () => {
    setOrderText("");
    setParsedItems([]);
    setBranch("");
    setRequester("");
    setUnparsedLines([]);
    setIsParsed(false);
  };

  const handleItemsChange = (items: ParsedOrderItem[]) => {
    setParsedItems(items);
  };

  // Convert parsed items to sales order lines
  const convertToOrderLines = (): Omit<SalesOrderLine, 'id' | 'sales_order_id' | 'created_at' | 'updated_at'>[] => {
    return parsedItems.map((item, index) => {
      const componentInfo = validationData?.itemDetails.get(item.itemCode);
      const unitPrice = componentInfo?.price || 0;
      const unit = componentInfo?.unit || 'unit';
      
      return {
        line_number: index + 1,
        item_code: item.itemCode,
        item_name: componentInfo?.name || item.itemCode,
        quantity: item.quantity,
        unit_price: unitPrice,
        uom: unit.toUpperCase(),
        sub_total: item.quantity * unitPrice,
        line_remarks: item.notes || undefined,
      };
    });
  };

  const handleSaveDraft = async () => {
    if (!storeId) {
      toast.error("Please select a store");
      return;
    }
    if (parsedItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    const lines = convertToOrderLines();
    const description = requester ? `Quick Order - Requested by: ${requester}` : "Quick Order Entry";

    await createMutation.mutateAsync({
      store_id: storeId,
      debtor_code: selectedStore?.stores?.debtor_code || "",
      doc_date: docDate,
      delivery_date: deliveryDate || undefined,
      description,
      lines,
    });

    navigate("/store/orders");
  };

  const handleSubmitOrder = async () => {
    if (!storeId) {
      toast.error("Please select a store");
      return;
    }
    if (parsedItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    // Warn about unrecognized items
    const invalidItems = parsedItems.filter(item => item.isValid === false);
    if (invalidItems.length > 0) {
      const proceed = window.confirm(
        `${invalidItems.length} item(s) have unrecognized item codes. They will have ₱0 unit price. Continue?`
      );
      if (!proceed) return;
    }

    const lines = convertToOrderLines();
    const description = requester ? `Quick Order - Requested by: ${requester}` : "Quick Order Entry";

    const order = await createMutation.mutateAsync({
      store_id: storeId,
      debtor_code: selectedStore?.stores?.debtor_code || "",
      doc_date: docDate,
      delivery_date: deliveryDate || undefined,
      description,
      lines,
    });

    const isFranchisee = selectedStore?.stores?.store_type === "franchisee";

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
            <h1 className="text-3xl font-bold tracking-tight">Quick Order Entry</h1>
            <p className="text-muted-foreground">
              Parse order messages from messaging apps
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
              <CardDescription>
                Select the store and date before parsing the order message
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="store">Store *</Label>
                  <Select value={storeId} onValueChange={setStoreId}>
                    <SelectTrigger id="store">
                      <SelectValue placeholder="Select store" />
                    </SelectTrigger>
                    <SelectContent>
                      {userStores?.map((assignment) => (
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
            </CardContent>
          </Card>

          {/* Order Text Input */}
          <Card>
            <CardHeader>
              <CardTitle>Order Message</CardTitle>
              <CardDescription>
                Paste the order message from Messenger, WhatsApp, Viber, etc.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuickOrderInput
                value={orderText}
                onChange={setOrderText}
                onParse={handleParse}
                onClear={handleClear}
                disabled={createMutation.isPending}
              />
            </CardContent>
          </Card>

          {/* Parsed Metadata */}
          {isParsed && (branch || requester) && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-6">
                  {branch && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Branch:</span>
                      <span>{branch}</span>
                    </div>
                  )}
                  {requester && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Requested by:</span>
                      <span>{requester}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Parsed Items Table */}
          {isParsed && (
            <Card>
              <CardHeader>
                <CardTitle>Parsed Items</CardTitle>
                <CardDescription>
                  Review and edit the parsed items before creating the order
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ParsedOrderTable
                  items={parsedItems}
                  onItemsChange={handleItemsChange}
                  itemDetails={validationData?.itemDetails}
                />
              </CardContent>
            </Card>
          )}

          {/* Unparsed Lines Warning */}
          {isParsed && unparsedLines.length > 0 && (
            <Alert variant="default" className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800">Unparsed Lines</AlertTitle>
              <AlertDescription className="text-yellow-700">
                <p className="mb-2">The following lines could not be parsed:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {unparsedLines.slice(0, 10).map((line, i) => (
                    <li key={i} className="text-yellow-600">{line}</li>
                  ))}
                  {unparsedLines.length > 10 && (
                    <li className="text-yellow-600 italic">
                      ...and {unparsedLines.length - 10} more
                    </li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          {isParsed && parsedItems.length > 0 && (
            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => navigate("/store/orders")}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={createMutation.isPending || parsedItems.length === 0}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
              <Button
                onClick={handleSubmitOrder}
                disabled={createMutation.isPending || updateMutation.isPending || parsedItems.length === 0}
              >
                <Send className="mr-2 h-4 w-4" />
                Submit Order
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
