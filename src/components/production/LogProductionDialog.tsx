import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Check, ChevronsUpDown } from "lucide-react";
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

interface LogProductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    component_id: string;
    item_type: "component" | "raw_material";
    quantity: number;
    notes?: string;
  }) => void;
  isLoading?: boolean;
  editingLog?: ProductionLogData | null;
}

interface BomOption {
  value: string; // `${type}:${id}`
  itemType: "component" | "raw_material";
  itemId: string;
  label: string;
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

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      selection: "",
      quantity: 1,
      notes: "",
    },
  });

  // Products with BOMs + Raw materials with BOMs
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
            label: `${r.name} (${r.sku}) — Raw Material`,
          });
        }
      }

      return result.sort((a, b) => a.label.localeCompare(b.label));
    },
  });

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
      }
    }
  }, [open, editingLog, form]);

  const handleSubmit = (data: FormData) => {
    const opt = options.find((o) => o.value === data.selection);
    if (!opt) return;
    onSubmit({
      component_id: opt.itemId,
      item_type: opt.itemType,
      quantity: data.quantity,
      notes: data.notes,
    });
    form.reset();
  };

  const isEditing = !!editingLog;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
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
