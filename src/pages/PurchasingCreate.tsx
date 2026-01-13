import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { dateFormatters } from "@/lib/datetime";
import { useIsMobile } from "@/hooks/use-mobile";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/currency";

const poSchema = z.object({
  supplier_id: z.string().min(1, "Supplier is required"),
  doc_date: z.string().min(1, "Date is required"),
  delivery_date: z.string().optional(),
  remarks: z.string().optional(),
  is_cash_purchase: z.boolean().default(false),
  cash_advance: z.number().optional(),
  cash_given_by: z.string().optional(),
});
type POFormData = z.infer<typeof poSchema>;
interface POLine {
  component_id?: string;
  raw_material_id?: string;
  item_name?: string;
  item_type: 'component' | 'raw_material';
  quantity: number;
  unit_price: number;
  uom: string;
  line_remarks?: string;
}
export default function PurchasingCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [lines, setLines] = useState<POLine[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<string>("");
  const [isCashPurchase, setIsCashPurchase] = useState(false);
  const [itemType, setItemType] = useState<'component' | 'raw_material'>('component');
  
  const { data: suppliers } = useSuppliers(true);
  const { data: components } = useQuery({
    queryKey: ["components"],
    queryFn: async () => {
      const { data, error } = await supabase.from("components").select("*").order("name");
      if (error) throw error;
      return data;
    }
  });

  const { data: rawMaterials } = useQuery({
    queryKey: ["raw-materials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("raw_materials").select("*").order("name");
      if (error) throw error;
      return data;
    }
  });


  const { data: users } = useQuery({
    queryKey: ["user-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<POFormData>({
    resolver: zodResolver(poSchema),
    defaultValues: {
      doc_date: dateFormatters.input(new Date()),
      is_cash_purchase: false,
      cash_advance: 0,
    }
  });
  const createPOMutation = useMutation({
    mutationFn: async (data: POFormData & { lines: POLine[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Generate PO number
      const { data: lastPO } = await supabase
        .from("purchase_orders")
        .select("po_number")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      let nextNumber = 1;
      if (lastPO?.po_number) {
        const match = lastPO.po_number.match(/PO(\d+)/);
        if (match) nextNumber = parseInt(match[1]) + 1;
      }
      const po_number = `PO${nextNumber.toString().padStart(5, "0")}`;
      const total_amount = data.lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
      
      const { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .insert({
          po_number,
          supplier_id: data.supplier_id,
          doc_date: data.doc_date,
          delivery_date: data.delivery_date || null,
          remarks: data.remarks,
          total_amount,
          status: "draft",
          created_by: user.id,
          is_cash_purchase: data.is_cash_purchase || false,
          cash_advance: data.cash_advance || 0,
          cash_given_by: data.cash_given_by || null,
        })
        .select()
        .single();
      
      if (poError) throw poError;
      
      const poLines = data.lines.map((line, index) => ({
        purchase_order_id: po.id,
        component_id: line.component_id || null,
        raw_material_id: line.raw_material_id || null,
        item_type: line.item_type,
        quantity: line.quantity,
        unit_price: line.unit_price,
        uom: line.uom,
        line_remarks: line.line_remarks,
        line_number: index + 1
      }));
      
      const { error: linesError } = await supabase
        .from("purchase_order_lines")
        .insert(poLines);
      
      if (linesError) throw linesError;
      return po;
    },
    onSuccess: po => {
      toast.success("Purchase order created successfully");
      queryClient.invalidateQueries({
        queryKey: ["purchase-orders"]
      });
      navigate(`/purchasing/${po.id}`);
    },
    onError: error => {
      toast.error("Failed to create purchase order");
      console.error(error);
    }
  });
  const onSubmit = (data: POFormData) => {
    if (lines.length === 0) {
      toast.error("Please add at least one line item");
      return;
    }
    createPOMutation.mutate({
      ...data,
      lines
    });
  };
  const addLine = () => {
    if (!selectedComponent) {
      toast.error(itemType === 'raw_material' ? "Please select a raw material" : "Please select a component");
      return;
    }
    
    if (itemType === 'raw_material') {
      const rawMaterial = rawMaterials?.find(r => r.id === selectedComponent);
      if (!rawMaterial) return;
      setLines([...lines, {
        raw_material_id: selectedComponent,
        item_name: rawMaterial.name,
        item_type: 'raw_material',
        quantity: 1,
        unit_price: rawMaterial.cost_per_unit || 0,
        uom: rawMaterial.unit
      }]);
    } else {
      const component = components?.find(c => c.id === selectedComponent);
      if (!component) return;
      setLines([...lines, {
        component_id: selectedComponent,
        item_name: component.name,
        item_type: 'component',
        quantity: 1,
        unit_price: component.cost_per_unit || 0,
        uom: component.unit
      }]);
    }
    
    setSelectedComponent("");
  };
  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };
  const updateLine = (index: number, field: keyof POLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = {
      ...newLines[index],
      [field]: value
    };
    setLines(newLines);
  };
  const totalAmount = lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
  return <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4 px-[15px] py-[18px]">
          <Button variant="ghost" size="icon" onClick={() => navigate("/purchasing")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create Purchase Order</h1>
            <p className="text-muted-foreground">Create a new purchase order for supplier procurement</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Purchase Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2 mb-4 p-4 bg-muted/50 rounded-lg">
                <Checkbox
                  id="is_cash_purchase"
                  checked={isCashPurchase}
                  onCheckedChange={(checked) => {
                    setIsCashPurchase(checked as boolean);
                    setValue("is_cash_purchase", checked as boolean);
                    setLines([]);
                    setSelectedComponent("");
                  }}
                />
                <Label htmlFor="is_cash_purchase" className="text-sm font-medium cursor-pointer">
                  This is a Cash Purchase (Market Day)
                </Label>
                <p className="text-xs text-muted-foreground ml-6">
                  For raw material purchases made with cash advance at the market. Uses raw materials only.
                </p>
              </div>

              {isCashPurchase && (
                <div className="grid gap-4 md:grid-cols-2 p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="space-y-2">
                    <Label htmlFor="cash_advance">Cash Advance Amount</Label>
                    <Input
                      id="cash_advance"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register("cash_advance", { valueAsNumber: true })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cash_given_by">Cash Given By</Label>
                    <Select onValueChange={(value) => setValue("cash_given_by", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="supplier_id">Supplier *</Label>
                  <Select onValueChange={value => setValue("supplier_id", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers?.map(supplier => <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.company_name} ({supplier.supplier_code})
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.supplier_id && <p className="text-sm text-destructive">{errors.supplier_id.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="doc_date">PO Date *</Label>
                  <Input id="doc_date" type="date" {...register("doc_date")} />
                  {errors.doc_date && <p className="text-sm text-destructive">{errors.doc_date.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery_date">Delivery Date</Label>
                  <Input id="delivery_date" type="date" {...register("delivery_date")} />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Textarea id="remarks" {...register("remarks")} rows={3} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Item Type Selector */}
              <div className="flex gap-2 p-3 bg-muted/50 rounded-lg">
                <Label className="flex items-center text-sm font-medium mr-4">Item Type:</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="itemType"
                      checked={itemType === 'component'}
                      onChange={() => {
                        setItemType('component');
                        setSelectedComponent("");
                      }}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm">Inventory Items (Components)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="itemType"
                      checked={itemType === 'raw_material'}
                      onChange={() => {
                        setItemType('raw_material');
                        setSelectedComponent("");
                      }}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm">Raw Materials</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <SearchableSelect
                  className="flex-1"
                  value={selectedComponent}
                  onValueChange={setSelectedComponent}
                  placeholder={itemType === 'raw_material' ? "Select raw material to add" : "Select component to add"}
                  searchPlaceholder={itemType === 'raw_material' ? "Search raw materials..." : "Search components..."}
                  emptyMessage={itemType === 'raw_material' ? "No raw materials found." : "No components found."}
                  options={
                    itemType === 'raw_material'
                      ? (rawMaterials?.map(material => ({
                          value: material.id,
                          label: `${material.name} (${material.sku})`,
                        })) || [])
                      : (components?.map(component => ({
                          value: component.id,
                          label: `${component.name} (${component.sku})`,
                        })) || [])
                  }
                />
                <Button type="button" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line
                </Button>
              </div>

              {lines.length > 0 && <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="w-20">Type</TableHead>
                        <TableHead className="w-24">Quantity</TableHead>
                        <TableHead className="w-32">Unit Price</TableHead>
                        <TableHead className="w-20">UOM</TableHead>
                        <TableHead className="w-32">Subtotal</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line, index) => <TableRow key={index}>
                          <TableCell className="font-medium">{line.item_name}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-1 rounded-full ${line.item_type === 'raw_material' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                              {line.item_type === 'raw_material' ? 'Raw' : 'Inv'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Input type="number" min="0" step="0.01" value={line.quantity} onChange={e => updateLine(index, "quantity", parseFloat(e.target.value) || 0)} className="w-full" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min="0" step="0.01" value={line.unit_price} onChange={e => updateLine(index, "unit_price", parseFloat(e.target.value) || 0)} className="w-full" />
                          </TableCell>
                          <TableCell>{line.uom}</TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(line.quantity * line.unit_price)}
                          </TableCell>
                          <TableCell>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>)}
                    </TableBody>
                  </Table>
                </div>}

              <div className="flex justify-end pt-4 border-t">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate("/purchasing")}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPOMutation.isPending}>
              {createPOMutation.isPending ? "Creating..." : "Create Purchase Order"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>;
}