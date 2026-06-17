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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, ChevronsUpDown, ArrowRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddFromRawMaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
}

const unitOptions = ["kg", "g", "mg", "l", "ml", "cl", "gal", "pcs", "unit"];

type OutputMode = "existing" | "new";

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
  const [outputMode, setOutputMode] = useState<OutputMode>("existing");
  const [outputId, setOutputId] = useState("");
  const [outputOpen, setOutputOpen] = useState(false);
  const [outputName, setOutputName] = useState("");
  const [outputQty, setOutputQty] = useState("");
  const [outputUnit, setOutputUnit] = useState("pcs");

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
  const selectedOutput = rawMaterials.find((rm) => rm.id === outputId);

  // Detect potential duplicate when creating new
  const trimmedName = outputName.trim().toLowerCase();
  const duplicateMatch =
    outputMode === "new" && trimmedName
      ? rawMaterials.find((rm) => rm.name.trim().toLowerCase() === trimmedName)
      : null;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!sourceId || !inputQty || !outputQty) {
        throw new Error("Source, input qty and output qty are required");
      }

      let outputRmId = outputId;
      let outputRmName = selectedOutput?.name ?? "";
      let outputRmUnit = selectedOutput?.unit ?? outputUnit;

      if (outputMode === "new") {
        if (!outputName.trim()) throw new Error("Output name is required");

        // Hard-stop duplicates (case-insensitive name match)
        if (duplicateMatch) {
          throw new Error(
            `A raw material named "${duplicateMatch.name}" already exists (${duplicateMatch.sku}). Switch to "Use existing" and select it instead.`
          );
        }

        const { data: nextCode, error: codeError } = await supabase.rpc(
          "get_next_raw_material_code"
        );
        if (codeError) throw codeError;

        const { data: newRm, error: rmError } = await supabase
          .from("raw_materials")
          .insert({
            sku: nextCode,
            name: outputName.trim(),
            unit: outputUnit,
            stock_quantity: 0,
            reserved_quantity: 0,
            description: `Processed from ${selectedSource?.name} (${inputQty} ${selectedSource?.unit} → ${outputQty} ${outputUnit})`,
          })
          .select("id, name, unit")
          .single();
        if (rmError) throw rmError;

        outputRmId = newRm.id;
        outputRmName = newRm.name;
        outputRmUnit = newRm.unit;
      } else {
        if (!outputId) throw new Error("Select the output raw material");
      }

      // Add input raw material to BOM (consumed)
      const { error: bomError1 } = await supabase.from("bom_items").insert({
        product_id: productId,
        item_type: "raw_material",
        raw_material_id: sourceId,
        quantity: parseFloat(inputQty),
        notes: `Input for ${outputRmName} (yields ${outputQty} ${outputRmUnit})`,
      });
      if (bomError1) throw bomError1;

      // Add output raw material to BOM (produced)
      const { error: bomError2 } = await supabase.from("bom_items").insert({
        product_id: productId,
        item_type: "raw_material",
        raw_material_id: outputRmId,
        quantity: parseFloat(outputQty),
        notes: `Output from ${selectedSource?.name} (${inputQty} ${selectedSource?.unit} input)`,
      });
      if (bomError2) throw bomError2;

      return { outputRmName };
    },
    onSuccess: ({ outputRmName }) => {
      queryClient.invalidateQueries({ queryKey: ["bom-items", productId] });
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      toast({
        title: "Raw material conversion added",
        description: `${selectedSource?.name} → ${outputRmName} added to BOM`,
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
    setOutputMode("existing");
    setOutputId("");
    setOutputName("");
    setOutputQty("");
    setOutputUnit("pcs");
    onOpenChange(false);
  };

  const canSubmit =
    sourceId &&
    inputQty &&
    outputQty &&
    (outputMode === "existing" ? !!outputId : !!outputName.trim() && !duplicateMatch) &&
    !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add from Raw Materials</DialogTitle>
          <DialogDescription>
            Define a raw material conversion — consume one raw material and yield another
            (e.g., 1 box lemons → 145 pcs lemons).
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

          {/* Output mode toggle */}
          <div>
            <Label>Output Raw Material</Label>
            <RadioGroup
              value={outputMode}
              onValueChange={(v) => setOutputMode(v as OutputMode)}
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="existing" id="out-existing" />
                <Label htmlFor="out-existing" className="font-normal cursor-pointer">
                  Use existing
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="new" id="out-new" />
                <Label htmlFor="out-new" className="font-normal cursor-pointer">
                  Create new
                </Label>
              </div>
            </RadioGroup>
          </div>

          {outputMode === "existing" ? (
            <div>
              <Popover open={outputOpen} onOpenChange={setOutputOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {selectedOutput
                      ? `${selectedOutput.sku} - ${selectedOutput.name}`
                      : "Select output raw material..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[360px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search raw materials..." />
                    <CommandList>
                      <CommandEmpty>No raw material found.</CommandEmpty>
                      <CommandGroup>
                        {rawMaterials
                          .filter((rm) => rm.id !== sourceId)
                          .map((rm) => (
                            <CommandItem
                              key={rm.id}
                              value={`${rm.sku} ${rm.name}`}
                              onSelect={() => {
                                setOutputId(rm.id);
                                setOutputOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  outputId === rm.id ? "opacity-100" : "opacity-0"
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
          ) : (
            <div>
              <Label>Output Name (new raw material)</Label>
              <Input
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                placeholder="e.g., Lemon (pc)"
              />
              {duplicateMatch && (
                <div className="mt-2 flex items-start gap-2 p-2 rounded-md border border-destructive/50 bg-destructive/10 text-xs text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    "{duplicateMatch.name}" already exists ({duplicateMatch.sku}).
                    Switch to <strong>Use existing</strong> and select it to avoid a
                    duplicate.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Output Quantity + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Output Quantity</Label>
              <Input
                type="number"
                step="0.001"
                value={outputQty}
                onChange={(e) => setOutputQty(e.target.value)}
                placeholder="e.g., 145"
              />
            </div>
            <div>
              <Label>Output Unit</Label>
              {outputMode === "existing" ? (
                <Input
                  value={selectedOutput?.unit ?? ""}
                  disabled
                  placeholder="—"
                />
              ) : (
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
              )}
            </div>
          </div>

          {/* Preview */}
          {selectedSource && inputQty && outputQty &&
            (outputMode === "existing" ? selectedOutput : outputName && !duplicateMatch) && (
              <div className="p-3 rounded-md border bg-muted/30 text-sm">
                <span className="font-medium">{inputQty} {selectedSource.unit}</span>{" "}
                {selectedSource.name}{" "}
                <ArrowRight className="inline h-4 w-4 mx-1" />{" "}
                <span className="font-medium">
                  {outputQty} {outputMode === "existing" ? selectedOutput?.unit : outputUnit}
                </span>{" "}
                {outputMode === "existing" ? selectedOutput?.name : outputName}
                <p className="text-xs text-muted-foreground mt-1">
                  {outputMode === "existing"
                    ? "Both input and output will be added to the BOM (no new raw material created)."
                    : `A new raw material "${outputName}" will be created with an auto-generated SKU.`}
                </p>
              </div>
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit}>
            {mutation.isPending ? "Saving..." : "Add to BOM"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
