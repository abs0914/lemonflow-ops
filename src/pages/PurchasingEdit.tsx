import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, ArrowLeft, Save } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuppliers } from "@/hooks/useSuppliers";
import { usePurchaseOrder, usePurchaseOrderLines } from "@/hooks/usePurchaseOrders";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

const poSchema = z.object({
  supplier_id: z.string().min(1, "Supplier is required"),
  doc_date: z.string().min(1, "Date is required"),
  delivery_date: z.string().optional(),
  remarks: z.string().optional(),
});

type POFormData = z.infer<typeof poSchema>;

interface POLine {
  id?: string;
  component_id: string;
  component_name?: string;
  quantity: number;
  unit_price: number;
  uom: string;
  line_remarks?: string;
}

export default function PurchasingEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<POLine[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<string>("");

  const { data: purchaseOrder, isLoading: loadingPO } = usePurchaseOrder(id);
  const { data: existingLines, isLoading: loadingLines } = usePurchaseOrderLines(id);
  const { data: suppliers } = useSuppliers(true);
  
  const { data: components } = useQuery({
    queryKey: ["components"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("components")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<POFormData>({
    resolver: zodResolver(poSchema),
  });

  // Initialize form with existing data
  useState(() => {
    if (purchaseOrder && !loadingPO) {
      setValue("supplier_id", purchaseOrder.supplier_id);
      setValue("doc_date", format(new Date(purchaseOrder.doc_date), "yyyy-MM-dd"));
      if (purchaseOrder.delivery_date) {
        setValue("delivery_date", format(new Date(purchaseOrder.delivery_date), "yyyy-MM-dd"));
      }
      setValue("remarks", purchaseOrder.remarks || "");
    }
  });

  useState(() => {
    if (existingLines && !loadingLines) {
      setLines(
        existingLines.map((line) => ({
          id: line.id,
          component_id: line.component_id,
          component_name: line.components?.name,
          quantity: line.quantity,
          unit_price: line.unit_price,
          uom: line.uom,
          line_remarks: line.line_remarks || "",
        }))
      );
    }
  });

  const updatePOMutation = useMutation({
    mutationFn: async (data: POFormData & { lines: POLine[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const total_amount = data.lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);

      // Update PO header
      const { error: poError } = await supabase
        .from("purchase_orders")
        .update({
          supplier_id: data.supplier_id,
          doc_date: data.doc_date,
          delivery_date: data.delivery_date || null,
          remarks: data.remarks,
          total_amount,
        })
        .eq("id", id);

      if (poError) throw poError;

      // Delete existing lines
      const { error: deleteError } = await supabase
        .from("purchase_order_lines")
        .delete()
        .eq("purchase_order_id", id);

      if (deleteError) throw deleteError;

      // Insert new lines
      const poLines = data.lines.map((line, index) => ({
        purchase_order_id: id,
        component_id: line.component_id,
        quantity: line.quantity,
        unit_price: line.unit_price,
        uom: line.uom,
        line_remarks: line.line_remarks,
        line_number: index + 1,
      }));

      const { error: linesError } = await supabase
        .from("purchase_order_lines")
        .insert(poLines);

      if (linesError) throw linesError;
    },
    onSuccess: () => {
      toast.success("Purchase order updated successfully");
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      navigate(`/purchasing/${id}`);
    },
    onError: (error) => {
      toast.error("Failed to update purchase order");
      console.error(error);
    },
  });

  const onSubmit = (data: POFormData) => {
    if (lines.length === 0) {
      toast.error("Please add at least one line item");
      return;
    }
    updatePOMutation.mutate({ ...data, lines });
  };

  const addLine = () => {
    if (!selectedComponent) {
      toast.error("Please select a component");
      return;
    }

    const component = components?.find((c) => c.id === selectedComponent);
    if (!component) return;

    setLines([
      ...lines,
      {
        component_id: selectedComponent,
        component_name: component.name,
        quantity: 1,
        unit_price: component.cost_per_unit || 0,
        uom: component.unit,
      },
    ]);
    setSelectedComponent("");
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof POLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const totalAmount = lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);

  if (loadingPO || loadingLines) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!purchaseOrder || purchaseOrder.status !== "draft") {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <h2 className="text-2xl font-semibold">Cannot Edit Purchase Order</h2>
          <p className="text-muted-foreground">Only draft purchase orders can be edited</p>
          <Button onClick={() => navigate("/purchasing")}>Back to Purchase Orders</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/purchasing/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Purchase Order {purchaseOrder.po_number}</h1>
            <p className="text-muted-foreground">Modify purchase order details and line items</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Purchase Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="supplier_id">Supplier *</Label>
                  <Select value={watch("supplier_id")} onValueChange={(value) => setValue("supplier_id", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers?.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.company_name} ({supplier.supplier_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.supplier_id && (
                    <p className="text-sm text-destructive">{errors.supplier_id.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="doc_date">PO Date *</Label>
                  <Input
                    id="doc_date"
                    type="date"
                    {...register("doc_date")}
                  />
                  {errors.doc_date && (
                    <p className="text-sm text-destructive">{errors.doc_date.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery_date">Delivery Date</Label>
                  <Input
                    id="delivery_date"
                    type="date"
                    {...register("delivery_date")}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Textarea
                    id="remarks"
                    {...register("remarks")}
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Select value={selectedComponent} onValueChange={setSelectedComponent}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select component to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {components?.map((component) => (
                      <SelectItem key={component.id} value={component.id}>
                        {component.name} ({component.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line
                </Button>
              </div>

              {lines.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Component</TableHead>
                        <TableHead className="w-24">Quantity</TableHead>
                        <TableHead className="w-32">Unit Price</TableHead>
                        <TableHead className="w-20">UOM</TableHead>
                        <TableHead className="w-32">Subtotal</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{line.component_name}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.quantity}
                              onChange={(e) => updateLine(index, "quantity", parseFloat(e.target.value) || 0)}
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.unit_price}
                              onChange={(e) => updateLine(index, "unit_price", parseFloat(e.target.value) || 0)}
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell>{line.uom}</TableCell>
                          <TableCell className="font-medium">
                            ${(line.quantity * line.unit_price).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLine(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold">${totalAmount.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate(`/purchasing/${id}`)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updatePOMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updatePOMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}