import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Check, ChevronsUpDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddFromRawMaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
}

const unitOptions = ["kg", "g", "mg", "l", "ml", "cl", "gal", "pcs", "unit"];

export function AddFromRawMaterialDialog({
  open,
  onOpenChange,
  productId,
}: AddFromRawMaterialDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sourceId, setSourceId] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [inputQty, setInputQty] = useState("");
  const [outputName, setOutputName] = useState("");
  const [outputQty, setOutputQty] = useState("");
  const [outputUnit, setOutputUnit] = useState("ml");

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ["raw-materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raw_materials")
        .select("id, name, sku, unit, cost_per_unit")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const selectedSource = rawMaterials.find((rm) => rm.id === sourceId);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!sourceId || !inputQty || !outputName || !outputQty) {
        throw new Error("All fields are required");
      }

      // Get next raw material code
      const { data: nextCode, error: codeError } = await supabase.rpc(
        "get_next_raw_material_code"
      );
      if (codeError) throw codeError;

      // Create new raw material (the output)
      const { data: newRm, error: rmError } = await supabase
        .from("raw_materials")
        .insert({
          sku: nextCode,
          name: outputName,
          unit: outputUnit,
          stock_quantity: 0,
          reserved_quantity: 0,
          description: `Processed from ${selectedSource?.name} (${inputQty} ${selectedSource?.unit} → ${outputQty} ${outputUnit})`,
        })
        .select("id")
        .single();
      if (rmError) throw rmError;

      // Add input raw material to BOM (consumed)
      const { error: bomError1 } = await supabase.from("bom_items").insert({
        product_id: productId,
        item_type: "raw_material",
        raw_material_id: sourceId,
        quantity: parseFloat(inputQty),
        notes: `Input for ${outputName} (yields ${outputQty} ${outputUnit})`,
      });
      if (bomError1) throw bomError1;

      // Add output raw material to BOM (produced)
      const { error: bomError2 } = await supabase.from("bom_items").insert({
        product_id: productId,
        item_type: "raw_material",
        raw_material_id: newRm.id,
        quantity: parseFloat(outputQty),
        notes: `Output from ${selectedSource?.name} (${inputQty} ${selectedSource?.unit} input)`,
      });
      if (bomError2) throw bomError2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bom-items", productId] });
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      toast({
        title: "Raw material conversion added",
        description: `${selectedSource?.name} → ${outputName} added to BOM`,
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setSourceId("");
    setInputQty("");
    setOutputName("");
    setOutputQty("");
    setOutputUnit("ml");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add from Raw Materials</DialogTitle>
          <DialogDescription>
            Define a raw material conversion — input a raw material and create
            a new raw material as the output (e.g., 1 kg mango fruit → 750 ml
            mango puree).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source Raw Material */}
          <div>
            <Label>Source Raw Material (Input)</Label>
            <Popover open={sourceOpen} onOpenChange={setSourceOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedSource
                    ? `${selectedSource.sku} - ${selectedSource.name}`
                    : "Select source raw material..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search raw materials..." />
                  <CommandList>
                    <CommandEmpty>No raw material found.</CommandEmpty>
                    <CommandGroup>
                      {rawMaterials.map((rm) => (
                        <CommandItem
                          key={rm.id}
                          value={`${rm.sku} ${rm.name}`}
                          onSelect={() => {
                            setSourceId(rm.id);
                            setSourceOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              sourceId === rm.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {rm.sku} - {rm.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Unit: {rm.unit}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Input Quantity */}
          <div>
            <Label>
              Input Quantity
              {selectedSource && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  ({selectedSource.unit})
                </span>
              )}
            </Label>
            <Input
              type="number"
              step="0.001"
              value={inputQty}
              onChange={(e) => setInputQty(e.target.value)}
              placeholder="e.g., 1"
            />
          </div>

          {/* Arrow separator */}
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <ArrowRight className="h-5 w-5" />
            <span className="text-sm font-medium">produces</span>
            <ArrowRight className="h-5 w-5" />
          </div>

          {/* Output Name */}
          <div>
            <Label>Output Name</Label>
            <Input
              value={outputName}
              onChange={(e) => setOutputName(e.target.value)}
              placeholder="e.g., Mango Puree"
            />
          </div>

          {/* Output Quantity + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Output Quantity</Label>
              <Input
                type="number"
                step="0.001"
                value={outputQty}
                onChange={(e) => setOutputQty(e.target.value)}
                placeholder="e.g., 750"
              />
            </div>
            <div>
              <Label>Output Unit</Label>
              <Select value={outputUnit} onValueChange={setOutputUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          {selectedSource && inputQty && outputName && outputQty && (
            <div className="p-3 rounded-md border bg-muted/30 text-sm">
              <span className="font-medium">{inputQty} {selectedSource.unit}</span>{" "}
              {selectedSource.name}{" "}
              <ArrowRight className="inline h-4 w-4 mx-1" />{" "}
              <span className="font-medium">{outputQty} {outputUnit}</span>{" "}
              {outputName}
              <p className="text-xs text-muted-foreground mt-1">
                A new raw material "{outputName}" will be created with SKU auto-generated.
                Both input and output will be added to the BOM.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={
              !sourceId ||
              !inputQty ||
              !outputName ||
              !outputQty ||
              mutation.isPending
            }
          >
            {mutation.isPending ? "Creating..." : "Add to BOM"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
