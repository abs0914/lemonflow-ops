import { useRef } from "react";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
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
import { formatCurrency } from "@/lib/currency";

interface StoreInventoryData {
  item_code: string;
  item_name: string;
  uom: string;
  total_quantity: number;
  order_count: number;
  total_value: number;
}

interface StoreInventoryReportTableProps {
  data: StoreInventoryData[];
  exportFileName: string;
}

export function StoreInventoryReportTable({ data, exportFileName }: StoreInventoryReportTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);

  const columns = [
    { key: "item_code", label: "Item Code" },
    { key: "item_name", label: "Item Name" },
    { key: "uom", label: "UOM" },
    { key: "total_quantity", label: "Total Qty", format: (v: number) => v.toLocaleString() },
    { key: "order_count", label: "# of Orders", format: (v: number) => v.toString() },
    { key: "total_value", label: "Total Value", format: (v: number) => formatCurrency(v) },
  ];

  const handleExportCSV = () => {
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = columns.map((c) => c.label).join(",");
    const rows = data.map((row) =>
      columns
        .map((c) => {
          const value = row[c.key as keyof StoreInventoryData];
          const formatted = c.format ? c.format(value as number) : value;
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
    toast.success("CSV exported successfully");
  };

  const handleExportExcel = () => {
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }

    const escapeXml = (str: string) => {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    };

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<?mso-application progid="Excel.Sheet"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
    xml += '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
    xml += '  <Styles>\n';
    xml += '    <Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#E0E0E0" ss:Pattern="Solid"/></Style>\n';
    xml += '    <Style ss:ID="Currency"><NumberFormat ss:Format="#,##0.00"/></Style>\n';
    xml += '    <Style ss:ID="Number"><NumberFormat ss:Format="#,##0"/></Style>\n';
    xml += '  </Styles>\n';
    xml += '  <Worksheet ss:Name="Store Inventory">\n';
    xml += '    <Table>\n';

    // Headers
    xml += '      <Row ss:StyleID="Header">\n';
    columns.forEach((col) => {
      xml += `        <Cell><Data ss:Type="String">${escapeXml(col.label)}</Data></Cell>\n`;
    });
    xml += '      </Row>\n';

    // Data rows
    data.forEach((row) => {
      xml += '      <Row>\n';
      columns.forEach((col) => {
        const value = row[col.key as keyof StoreInventoryData];
        const isNumber = typeof value === "number";
        const cellType = isNumber ? "Number" : "String";
        let styleId = "";
        if (col.key === "total_value") styleId = ' ss:StyleID="Currency"';
        else if (col.key === "total_quantity" || col.key === "order_count") styleId = ' ss:StyleID="Number"';
        xml += `        <Cell${styleId}><Data ss:Type="${cellType}">${isNumber ? value : escapeXml(String(value))}</Data></Cell>\n`;
      });
      xml += '      </Row>\n';
    });

    xml += '    </Table>\n';
    xml += '  </Worksheet>\n';
    xml += '</Workbook>';

    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${exportFileName}-${new Date().toISOString().split("T")[0]}.xls`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Excel file exported successfully");
  };

  const handlePrint = () => {
    if (data.length === 0) {
      toast.error("No data to print");
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Store Inventory Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 18px; margin-bottom: 10px; }
            .date { color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .number { text-align: right; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>Store Inventory Report</h1>
          <p class="date">Generated: ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                ${columns.map((col) => `<th>${col.label}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${data
                .map(
                  (row) => `
                <tr>
                  ${columns
                    .map((col) => {
                      const value = row[col.key as keyof StoreInventoryData];
                      const formatted = col.format ? col.format(value as number) : value;
                      const isNumber = ["total_quantity", "order_count", "total_value"].includes(col.key);
                      return `<td class="${isNumber ? "number" : ""}">${formatted}</td>`;
                    })
                    .join("")}
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Items Ordered from Central Inventory</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">No data available</p>
          </div>
        ) : (
          <div ref={tableRef} className="max-h-96 overflow-auto rounded-md border">
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
                          ? column.format(row[column.key as keyof StoreInventoryData] as number)
                          : row[column.key as keyof StoreInventoryData]}
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
