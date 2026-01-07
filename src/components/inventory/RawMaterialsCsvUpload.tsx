import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CsvRow {
  name: string;
  sku: string;
  description?: string;
  unit: string;
  stock_quantity: number;
  item_group?: string;
  item_type?: string;
  cost_per_unit?: number;
}

interface ParseResult {
  valid: CsvRow[];
  errors: { row: number; message: string }[];
}

const CSV_TEMPLATE = `name,sku,description,unit,stock_quantity,item_group,item_type,cost_per_unit
"Sample Raw Material","TLC-RAW-00001","Description here","pcs",100,"Raw Materials","Stock Item",10.50
"Another Material","TLC-RAW-00002","","kg",50,"Packaging","Stock Item",5.25`;

export function RawMaterialsCsvUpload() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "raw_materials_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Template Downloaded",
      description: "CSV template has been downloaded",
    });
  };

  const parseCSV = (text: string): ParseResult => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) {
      return { valid: [], errors: [{ row: 0, message: "File is empty or has no data rows" }] };
    }

    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
    const requiredHeaders = ["name", "sku", "unit", "stock_quantity"];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      return { 
        valid: [], 
        errors: [{ row: 0, message: `Missing required headers: ${missingHeaders.join(", ")}` }] 
      };
    }

    const valid: CsvRow[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parsing (handles quoted fields)
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx]?.replace(/^"|"$/g, "") || "";
      });

      // Validate required fields
      if (!row.name) {
        errors.push({ row: i + 1, message: "Name is required" });
        continue;
      }
      if (!row.sku) {
        errors.push({ row: i + 1, message: "SKU is required" });
        continue;
      }
      if (!row.unit) {
        errors.push({ row: i + 1, message: "Unit is required" });
        continue;
      }

      const stockQty = parseFloat(row.stock_quantity);
      if (isNaN(stockQty)) {
        errors.push({ row: i + 1, message: "Invalid stock_quantity" });
        continue;
      }

      valid.push({
        name: row.name,
        sku: row.sku,
        description: row.description || undefined,
        unit: row.unit,
        stock_quantity: stockQty,
        item_group: row.item_group || undefined,
        item_type: row.item_type || undefined,
        cost_per_unit: row.cost_per_unit ? parseFloat(row.cost_per_unit) : undefined,
      });
    }

    return { valid, errors };
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseCSV(text);
      setParseResult(result);
      setDialogOpen(true);
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async (rows: CsvRow[]) => {
      const { error } = await supabase.from("raw_materials").insert(
        rows.map(row => ({
          name: row.name,
          sku: row.sku,
          description: row.description,
          unit: row.unit,
          stock_quantity: row.stock_quantity,
          item_group: row.item_group,
          item_type: row.item_type,
          cost_per_unit: row.cost_per_unit,
          reserved_quantity: 0,
        }))
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Upload Successful",
        description: `${parseResult?.valid.length} raw materials imported`,
      });
      setDialogOpen(false);
      setParseResult(null);
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpload = () => {
    if (parseResult?.valid.length) {
      uploadMutation.mutate(parseResult.valid);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <Button variant="outline" onClick={downloadTemplate}>
        <Download className="mr-2 h-4 w-4" />
        Template
      </Button>
      
      <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
        <Upload className="mr-2 h-4 w-4" />
        Upload CSV
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              CSV Import Preview
            </DialogTitle>
            <DialogDescription>
              Review the parsed data before importing
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {parseResult?.valid.length ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                {parseResult.valid.length} valid rows ready to import
              </div>
            ) : null}

            {parseResult?.errors.length ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {parseResult.errors.length} errors found
                </div>
                <ScrollArea className="h-32 rounded border p-2">
                  {parseResult.errors.map((err, idx) => (
                    <div key={idx} className="text-xs text-muted-foreground">
                      Row {err.row}: {err.message}
                    </div>
                  ))}
                </ScrollArea>
              </div>
            ) : null}

            {parseResult?.valid.length ? (
              <ScrollArea className="h-48 rounded border">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">SKU</th>
                      <th className="p-2 text-left">Unit</th>
                      <th className="p-2 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.valid.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2">{row.name}</td>
                        <td className="p-2">{row.sku}</td>
                        <td className="p-2">{row.unit}</td>
                        <td className="p-2 text-right">{row.stock_quantity}</td>
                      </tr>
                    ))}
                    {parseResult.valid.length > 10 && (
                      <tr>
                        <td colSpan={4} className="p-2 text-center text-muted-foreground">
                          ... and {parseResult.valid.length - 10} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={!parseResult?.valid.length || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "Importing..." : `Import ${parseResult?.valid.length || 0} Items`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
