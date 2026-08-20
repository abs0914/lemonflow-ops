import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CsvColumn {
  header: string;
  key: string;
  format?: (value: unknown, row: Record<string, unknown>) => string | number;
}

interface ExportCsvButtonProps {
  table: "suppliers" | "stores";
  columns: CsvColumn[];
  fileName: string;
  label: string;
  orderBy?: string;
}

function csvCell(value: unknown) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function ExportCsvButton({
  table,
  columns,
  fileName,
  label,
  orderBy,
}: ExportCsvButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setLoading(true);
    try {
      let query = supabase.from(table).select("*").limit(5000);
      if (orderBy) query = query.order(orderBy);
      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as Record<string, unknown>[];
      if (rows.length === 0) {
        toast({ title: "Nothing to export", description: "No records found." });
        return;
      }

      const csv = [
        columns.map((c) => csvCell(c.header)).join(","),
        ...rows.map((row) =>
          columns
            .map((c) => csvCell(c.format ? c.format(row[c.key], row) : row[c.key]))
            .join(",")
        ),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}-${new Date().toISOString().split("T")[0]}.csv`;
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "Export ready", description: `${rows.length} records exported.` });
    } catch (error: unknown) {
      toast({
        title: "Export failed",
        description: (error as Error)?.message || "Could not export data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      {label}
    </Button>
  );
}

const boolCell = (v: unknown) => (v ? "Yes" : "No");
const dateCell = (v: unknown) =>
  v ? new Date(String(v)).toLocaleDateString("en-US") : "";

export const SUPPLIER_CSV_COLUMNS: CsvColumn[] = [
  { header: "Supplier Code", key: "supplier_code" },
  { header: "Company Name", key: "company_name" },
  { header: "Contact Person", key: "contact_person" },
  { header: "Phone", key: "phone" },
  { header: "Email", key: "email" },
  { header: "Address", key: "address" },
  { header: "Credit Terms (days)", key: "credit_terms" },
  { header: "Payment Terms", key: "payment_terms" },
  { header: "Active", key: "is_active", format: boolCell },
  { header: "Created At", key: "created_at", format: dateCell },
];

export const STORE_CSV_COLUMNS: CsvColumn[] = [
  { header: "Store Code", key: "store_code" },
  { header: "Store Name", key: "store_name" },
  { header: "Store Type", key: "store_type" },
  { header: "Debtor Code", key: "debtor_code" },
  { header: "Contact Person", key: "contact_person" },
  { header: "Phone", key: "phone" },
  { header: "Email", key: "email" },
  { header: "Address", key: "address" },
  { header: "City", key: "city" },
  { header: "Region", key: "region" },
  { header: "Opened Date", key: "opened_date", format: dateCell },
  { header: "Active", key: "is_active", format: boolCell },
  { header: "Created At", key: "created_at", format: dateCell },
];
