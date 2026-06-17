import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Check, ChevronsUpDown, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  selection: z.string().min(1, "Please select an item"),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export interface ProductionLogData {
  id: string;
  item_id: string;
  item_type?: string;
  quantity: number;
  notes: string | null;
}

export interface ActualConsumptionEntry {
  item_id: string;
  item_type: "component" | "raw_material";
  quantity: number;
}

interface LogProductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    component_id: string;
    item_type: "component" | "raw_material";
    quantity: number;
    notes?: string;
    product_id?: string;
    parent_raw_material_id?: string;
    actual_consumption?: ActualConsumptionEntry[];
  }) => void;
  isLoading?: boolean;
  editingLog?: ProductionLogData | null;
}

interface BomOption {
  value: string; // `${type}:${id}`
  itemType: "component" | "raw_material";
  itemId: string;
  productId?: string;
  parentRawMaterialId?: string;
  label: string;
}

interface BomIngredient {
  item_id: string;
  item_type: "component" | "raw_material";
  name: string;
  sku: string;
  unit: string;
  bom_quantity: number;
}

export function LogProductionDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  editingLog,
}: LogProductionDialogProps) {
  const [typeFilter, setTypeFilter] = React.useState<"all" | "component" | "raw_material">("all");
  const [comboOpen, setComboOpen] = React.useState(false);
  // keyed by `${item_type}:${item_id}` → user-edited actual qty (as string for input control)
  const [actualOverrides, setActualOverrides] = React.useState<Record<string, string>>({});

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      selection: "",
      quantity: 1,
      notes: "",
    },
  });

  const selection = form.watch("selection");
  const quantity = form.watch("quantity");

  const { data: options = [] } = useQuery({
    queryKey: ["bom-production-options"],
    queryFn: async (): Promise<BomOption[]> => {
      const [{ data: bomRows, error: bomErr }, { data: rmFlagged, error: rmFlagErr }, { data: products, error: prodErr }] = await Promise.all([
        supabase.from("bom_items").select("parent_raw_material_id"),
        supabase.from("raw_materials").select("id, name, sku").eq("is_bom_product", true).order("name"),
        supabase.from("products").select("id, name, sku, component_id").order("name"),
      ]);
      if (bomErr) throw bomErr;
      if (rmFlagErr) throw rmFlagErr;
      if (prodErr) throw prodErr;

      const rawIdSet = new Set<string>([
        ...((bomRows || []).map((b: any) => b.parent_raw_material_id).filter(Boolean) as string[]),
        ...((rmFlagged || []).map((r: any) => r.id) as string[]),
      ]);
      const rawIds = Array.from(rawIdSet);

      const result: BomOption[] = [];

      for (const p of products || []) {
        result.push({
          value: `component:${p.component_id || p.id}`,
          itemType: "component",
          itemId: p.component_id || p.id,
          productId: p.id,
          label: `${p.name} (${p.sku}) — Product`,
        });
      }

      if (rawIds.length > 0) {
        const { data: raws } = await supabase
          .from("raw_materials")
          .select("id, name, sku")
          .in("id", rawIds)
          .order("name");
        for (const r of raws || []) {
          result.push({
            value: `raw_material:${r.id}`,
            itemType: "raw_material",
            itemId: r.id,
            parentRawMaterialId: r.id,
            label: `${r.name} (${r.sku}) — Raw Material`,
          });
        }
      }

      return result.sort((a, b) => a.label.localeCompare(b.label));
    },
  });

  const selectedOption = options.find((o) => o.value === selection);

  // Fetch BOM ingredients for the selected production target
  const { data: bomIngredients = [] } = useQuery({
    queryKey: [
      "bom-ingredients",
      selectedOption?.productId || null,
      selectedOption?.parentRawMaterialId || null,
    ],
    enabled: !!selectedOption && !editingLog,
    queryFn: async (): Promise<BomIngredient[]> => {
      let query = supabase
        .from("bom_items")
        .select("item_type, raw_material_id, component_id, quantity");
      if (selectedOption?.productId) {
        query = query.eq("product_id", selectedOption.productId);
      } else if (selectedOption?.parentRawMaterialId) {
        query = query.eq("parent_raw_material_id", selectedOption.parentRawMaterialId);
      } else {
        return [];
      }
      const { data: bom, error } = await query;
      if (error) throw error;
      if (!bom || bom.length === 0) return [];

      const rawIds = bom.filter((b: any) => b.item_type === "raw_material").map((b: any) => b.raw_material_id).filter(Boolean);
      const compIds = bom.filter((b: any) => b.item_type === "component").map((b: any) => b.component_id).filter(Boolean);

      const [rmRes, cRes] = await Promise.all([
        rawIds.length > 0
          ? supabase.from("raw_materials").select("id, name, sku, unit").in("id", rawIds)
          : Promise.resolve({ data: [] as any[] }),
        compIds.length > 0
          ? supabase.from("components").select("id, name, sku, unit").in("id", compIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const rmMap = new Map<string, any>((rmRes.data || []).map((r: any) => [r.id, r]));
      const cMap = new Map<string, any>((cRes.data || []).map((c: any) => [c.id, c]));

      return bom.map((b: any) => {
        const isRaw = b.item_type === "raw_material";
        const info = isRaw ? rmMap.get(b.raw_material_id) : cMap.get(b.component_id);
        return {
          item_id: isRaw ? b.raw_material_id : b.component_id,
          item_type: isRaw ? "raw_material" : "component",
          name: info?.name || "(Unknown)",
          sku: info?.sku || "-",
          unit: info?.unit || "",
          bom_quantity: Number(b.quantity) || 0,
        } as BomIngredient;
      });
    },
  });

  // Reset overrides when selection changes
  React.useEffect(() => {
    setActualOverrides({});
  }, [selection]);

  React.useEffect(() => {
    if (open) {
      if (editingLog) {
        const t = (editingLog.item_type as "component" | "raw_material") || "component";
        form.reset({
          selection: `${t}:${editingLog.item_id}`,
          quantity: editingLog.quantity,
          notes: editingLog.notes || "",
        });
      } else {
        form.reset({
          selection: "",
          quantity: 1,
          notes: "",
        });
        setActualOverrides({});
      }
    }
  }, [open, editingLog, form]);

  const handleSubmit = (data: FormData) => {
    const opt = options.find((o) => o.value === data.selection);
    if (!opt) return;

    // Build actual_consumption from overrides (only for non-edit mode)
    let actual_consumption: ActualConsumptionEntry[] | undefined;
    if (!editingLog && bomIngredients.length > 0) {
      actual_consumption = bomIngredients.map((b) => {
        const key = `${b.item_type}:${b.item_id}`;
        const expected = b.bom_quantity * data.quantity;
        const overrideRaw = actualOverrides[key];
        const overrideNum = overrideRaw !== undefined && overrideRaw !== "" ? Number(overrideRaw) : NaN;
        const actual = Number.isFinite(overrideNum) && overrideNum >= 0 ? overrideNum : expected;
        return {
          item_id: b.item_id,
          item_type: b.item_type,
          quantity: actual,
        };
      });
    }

    onSubmit({
      component_id: opt.itemId,
      item_type: opt.itemType,
      quantity: data.quantity,
      notes: data.notes,
      product_id: opt.productId,
      parent_raw_material_id: opt.parentRawMaterialId,
      actual_consumption,
    });
    form.reset();
    setActualOverrides({});
  };

  const isEditing = !!editingLog;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[820px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Production Log" : "Log Completed Production"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="selection"
              render={({ field }) => {
                const filtered = options.filter(
                  (o) => typeFilter === "all" || o.itemType === typeFilter
                );
                const selected = options.find((o) => o.value === field.value);
                return (
                  <FormItem className="flex flex-col">
                    <FormLabel>Product</FormLabel>
                    <div className="flex flex-col sm:flex-row gap-2 w-full min-w-0">
                      <Select
                        value={typeFilter}
                        onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
                        disabled={isEditing}
                      >
                        <SelectTrigger className="w-full sm:w-[140px] shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="component">Products</SelectItem>
                          <SelectItem value="raw_material">Raw Materials</SelectItem>
                        </SelectContent>
                      </Select>
                      <Popover open={comboOpen} onOpenChange={setComboOpen}>
                        <PopoverTrigger asChild disabled={isEditing}>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "flex-1 min-w-0 justify-between font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <span className="truncate">
                                {selected ? selected.label : "Select a product"}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[60] bg-popover" align="start">
                          <Command>
                            <CommandInput placeholder="Search by name or SKU..." />
                            <CommandList>
                              <CommandEmpty>No items found.</CommandEmpty>
                              <CommandGroup>
                                {filtered.map((opt) => (
                                  <CommandItem
                                    key={opt.value}
                                    value={opt.label}
                                    onSelect={() => {
                                      field.onChange(opt.value);
                                      setComboOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === opt.value ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {opt.label}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity Produced</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="0.001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEditing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <FormLabel className="m-0">Materials Used (BOM)</FormLabel>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Info className="h-3 w-3" /> Override the actual quantity used if it differs from BOM expected.
                  </span>
                </div>
                {!selectedOption ? (
                  <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Select a product above to see and adjust BOM materials.
                  </div>
                ) : bomIngredients.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No BOM ingredients defined for this item.
                  </div>
                ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingredient</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Expected</TableHead>
                        <TableHead className="w-[140px]">Actual Used</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bomIngredients.map((b) => {
                        const key = `${b.item_type}:${b.item_id}`;
                        const qty = Number(quantity) || 0;
                        const expected = b.bom_quantity * qty;
                        const overrideRaw = actualOverrides[key];
                        const actualNum = overrideRaw !== undefined && overrideRaw !== ""
                          ? Number(overrideRaw)
                          : expected;
                        const variance = Number.isFinite(actualNum) ? actualNum - expected : 0;
                        return (
                          <TableRow key={key}>
                            <TableCell className="font-medium">{b.name}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{b.sku}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {expected.toLocaleString(undefined, { maximumFractionDigits: 3 })} {b.unit}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.001"
                                value={overrideRaw ?? expected.toString()}
                                onChange={(e) =>
                                  setActualOverrides((prev) => ({ ...prev, [key]: e.target.value }))
                                }
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right tabular-nums text-xs",
                                variance > 0 && "text-destructive",
                                variance < 0 && "text-emerald-600"
                              )}
                            >
                              {variance === 0
                                ? "—"
                                : `${variance > 0 ? "+" : ""}${variance.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${b.unit}`}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional production details..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (isEditing ? "Saving..." : "Logging...") : (isEditing ? "Save Changes" : "Log Production")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
