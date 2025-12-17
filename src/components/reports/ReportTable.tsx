import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface Column {
  key: string;
  label: string;
  format?: (value: any) => string;
}

interface ReportTableProps {
  title: string;
  columns: Column[];
  data: Record<string, any>[];
  exportFileName: string;
}

export function ReportTable({ title, columns, data, exportFileName }: ReportTableProps) {
  const handleExport = () => {
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = columns.map((c) => c.label).join(",");
    const rows = data.map((row) =>
      columns
        .map((c) => {
          const value = row[c.key];
          const formatted = c.format ? c.format(value) : value;
          // Escape commas and quotes for CSV
          const stringValue = String(formatted ?? "");
          if (stringValue.includes(",") || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(",")
    );

    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${exportFileName}-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Report exported successfully");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">No data available</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead key={column.key}>{column.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, i) => (
                  <TableRow key={i}>
                    {columns.map((column) => (
                      <TableCell key={column.key}>
                        {column.format
                          ? column.format(row[column.key])
                          : row[column.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
