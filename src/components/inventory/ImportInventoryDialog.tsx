import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImportInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedItem {
  sku: string;
  autocount_item_code?: string;
  name: string;
  item_group?: string;
  item_type?: string;
  stock_quantity: number;
  unit: string;
  low_stock_threshold?: number;
}

interface ImportResult {
  created: number;
  updated: number;
  errors: string[];
}

export function ImportInventoryDialog({ open, onOpenChange }: ImportInventoryDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      setParseError("Please select a CSV file");
      return;
    }

    setFile(selectedFile);
    setParseError(null);
    parseCSV(selectedFile);
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split("\n").filter(line => line.trim());
        
        if (lines.length < 2) {
          setParseError("CSV file must have a header row and at least one data row");
          return;
        }

        // Parse header
        const header = lines[0].split(",").map(h => h.trim().toLowerCase());
        const skuIndex = header.findIndex(h => h === "sku");
        const nameIndex = header.findIndex(h => h === "name");
        const autocountIndex = header.findIndex(h => h.includes("autocount") || h === "item code");
        const groupIndex = header.findIndex(h => h.includes("group"));
        const typeIndex = header.findIndex(h => h.includes("type"));
        const qtyIndex = header.findIndex(h => h.includes("stock") && h.includes("qty"));
        const unitIndex = header.findIndex(h => h === "unit");
        const thresholdIndex = header.findIndex(h => h.includes("threshold"));

        if (skuIndex === -1 || nameIndex === -1) {
          setParseError("CSV must have 'SKU' and 'Name' columns");
          return;
        }

        const items: ParsedItem[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.length === 0) continue;

          const sku = values[skuIndex]?.trim();
          const name = values[nameIndex]?.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
          
          if (!sku || !name) continue;

          items.push({
            sku,
            name,
            autocount_item_code: autocountIndex !== -1 ? values[autocountIndex]?.trim() : undefined,
            item_group: groupIndex !== -1 ? values[groupIndex]?.trim() : undefined,
            item_type: typeIndex !== -1 ? values[typeIndex]?.trim() : undefined,
            stock_quantity: qtyIndex !== -1 ? parseFloat(values[qtyIndex]) || 0 : 0,
            unit: unitIndex !== -1 ? values[unitIndex]?.trim() || "pcs" : "pcs",
            low_stock_threshold: thresholdIndex !== -1 ? parseInt(values[thresholdIndex]) || undefined : undefined,
          });
        }

        if (items.length === 0) {
          setParseError("No valid items found in CSV");
          return;
        }

        setParsedItems(items);
      } catch (err) {
        setParseError("Failed to parse CSV file");
      }
    };
    reader.readAsText(file);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleImport = async () => {
    if (parsedItems.length === 0) return;

    setImporting(true);
    const result: ImportResult = { created: 0, updated: 0, errors: [] };

    try {
      for (const item of parsedItems) {
        // Check if item exists by SKU
        const { data: existing } = await supabase
          .from("components")
          .select("id")
          .eq("sku", item.sku)
          .maybeSingle();

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from("components")
            .update({
              name: item.name,
              autocount_item_code: item.autocount_item_code || null,
              item_group: item.item_group || null,
              item_type: item.item_type || null,
              stock_quantity: item.stock_quantity,
              unit: item.unit,
              low_stock_threshold: item.low_stock_threshold || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (error) {
            result.errors.push(`Failed to update ${item.sku}: ${error.message}`);
          } else {
            result.updated++;
          }
        } else {
          // Create new
          const { error } = await supabase
            .from("components")
            .insert({
              sku: item.sku,
              name: item.name,
              autocount_item_code: item.autocount_item_code || null,
              item_group: item.item_group || null,
              item_type: item.item_type || null,
              stock_quantity: item.stock_quantity,
              reserved_quantity: 0,
              unit: item.unit,
              low_stock_threshold: item.low_stock_threshold || null,
            });

          if (error) {
            result.errors.push(`Failed to create ${item.sku}: ${error.message}`);
          } else {
            result.created++;
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["inventory"] });

      toast({
        title: "Import Complete",
        description: `Created: ${result.created}, Updated: ${result.updated}${result.errors.length > 0 ? `, Errors: ${result.errors.length}` : ""}`,
      });

      if (result.errors.length === 0) {
        handleClose();
      }
    } catch (err) {
      toast({
        title: "Import Failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedItems([]);
    setParseError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Inventory</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import inventory items. Required columns: SKU, Name.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium">{file.name}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to select a CSV file
                </p>
              </div>
            )}
          </div>

          {/* Parse Error */}
          {parseError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {parseError}
            </div>
          )}

          {/* Preview */}
          {parsedItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Found {parsedItems.length} items to import
              </div>
              <ScrollArea className="h-40 border rounded-md p-2">
                <div className="space-y-1 text-sm">
                  {parsedItems.slice(0, 20).map((item, i) => (
                    <div key={i} className="flex justify-between text-muted-foreground">
                      <span className="font-mono">{item.sku}</span>
                      <span className="truncate ml-2">{item.name}</span>
                    </div>
                  ))}
                  {parsedItems.length > 20 && (
                    <div className="text-muted-foreground italic">
                      ...and {parsedItems.length - 20} more
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={parsedItems.length === 0 || importing}
          >
            {importing ? "Importing..." : `Import ${parsedItems.length} Items`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
